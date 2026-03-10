import { io } from 'socket.io-client';
import {
  DeploymentRoomEvents,
  DeploymentStatusEvents,
  ZE_API_ENDPOINT,
  type DeploymentStatusEventPayload,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';

interface WaitForDeploymentStatusOptions {
  applicationVersionId: string;
  timeoutMs?: number;
}

function getTimeoutMs(timeoutMs?: number): number {
  if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }

  const envTimeout = Number(process.env['ZE_WAIT_FOR_DEPLOYMENT_TIMEOUT_MS'] || '');
  if (Number.isFinite(envTimeout) && envTimeout > 0) {
    return envTimeout;
  }

  return 15 * 60 * 1000;
}

export async function waitForDeploymentStatus(
  options: WaitForDeploymentStatusOptions
): Promise<DeploymentStatusEventPayload> {
  /**
   * Uses one deployment-specific error code so timeout/socket/terminal failures report
   * consistently.
   */
  const timeoutMs = getTimeoutMs(options.timeoutMs);
  ze_log.upload(
    `Waiting for deployment status updates for buildId ${options.applicationVersionId}`
  );

  return new Promise<DeploymentStatusEventPayload>((resolve, reject) => {
    const socket = io(ZE_API_ENDPOINT(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10_000,
    });

    let settled = false;

    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new ZephyrError(ZeErrors.ERR_DEPLOYMENT_STATUS_WAIT_FAILED, {
          buildId: options.applicationVersionId,
          message: `Timed out after ${timeoutMs.toString()}ms while waiting for deployment.`,
          cause: new Error(`Timed out after ${timeoutMs.toString()}ms`),
          data: {
            applicationVersionId: options.applicationVersionId,
          },
        })
      );
    }, timeoutMs);

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      socket.off('error', onError);
      socket.off(DeploymentStatusEvents.deploymentStatus, onStatus);
      socket.emit(DeploymentRoomEvents.leaveDeploymentRoom, {
        applicationVersionId: options.applicationVersionId,
      });
      socket.close();
    };

    const onConnect = () => {
      socket.emit(DeploymentRoomEvents.joinDeploymentRoom, {
        applicationVersionId: options.applicationVersionId,
      });
    };

    const onError = (error: unknown) => {
      cleanup();
      reject(
        new ZephyrError(ZeErrors.ERR_DEPLOYMENT_STATUS_WAIT_FAILED, {
          buildId: options.applicationVersionId,
          message:
            error instanceof Error
              ? error.message
              : 'WebSocket connection failed while waiting for deployment status.',
          cause: error,
          data: {
            applicationVersionId: options.applicationVersionId,
          },
        })
      );
    };

    const onStatus = (payload: DeploymentStatusEventPayload) => {
      if (payload.applicationVersionId !== options.applicationVersionId) {
        return;
      }

      if (payload.status === 'queued_retry') {
        ze_log.upload('Deployment queued for retry...');
      }

      if (!payload.terminal) {
        return;
      }

      if (payload.status === 'available') {
        cleanup();
        resolve(payload);
        return;
      }

      cleanup();
      reject(
        new ZephyrError(ZeErrors.ERR_DEPLOYMENT_STATUS_WAIT_FAILED, {
          buildId: options.applicationVersionId,
          message: payload.statusMessage || 'Deployment failed',
          cause: new Error(payload.statusMessage || 'Deployment failed'),
          data: {
            applicationVersionId: options.applicationVersionId,
            status: payload.status,
            source: payload.source,
          },
        })
      );
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onError);
    socket.on('error', onError);
    socket.on(DeploymentStatusEvents.deploymentStatus, onStatus);
  });
}
