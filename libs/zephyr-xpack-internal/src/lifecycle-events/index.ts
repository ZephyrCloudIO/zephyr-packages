import { EventEmitter } from 'node:events';
import { ze_log } from 'zephyr-agent';

const _lifecycle_events = new EventEmitter();

const _deployment_done = 'deployment-done';

export function emitDeploymentDone(error?: unknown): void {
  ze_log.misc('Deployment done');
  _lifecycle_events.emit(_deployment_done, error);
}

export async function onDeploymentDone(): Promise<void> {
  return new Promise((resolve, reject) => {
    ze_log.misc('Waiting for deployment done');
    _lifecycle_events.once(_deployment_done, (error?: unknown) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
