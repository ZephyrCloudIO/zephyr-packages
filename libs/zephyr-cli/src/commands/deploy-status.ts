import { logFn, waitForDeploymentStatus } from 'zephyr-agent';

export interface DeployStatusOptions {
  buildId: string;
}

export async function deployStatusCommand(options: DeployStatusOptions): Promise<void> {
  const { buildId } = options;

  const payload = await waitForDeploymentStatus({
    applicationVersionId: buildId,
  });

  logFn('info', `Deployment ${buildId} finished with status ${payload.status}`);
}
