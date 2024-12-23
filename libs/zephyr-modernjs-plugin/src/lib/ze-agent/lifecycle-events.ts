import { EventEmitter } from 'node:events';
import { ze_log } from 'zephyr-edge-contract';

const _lifecycle_events = new EventEmitter();

const _deployment_done = 'deployment-done';

export function emitDeploymentDone(): void {
  ze_log('Deployment done');
  _lifecycle_events.emit(_deployment_done);
}

export async function onDeploymentDone(): Promise<string> {
  return new Promise((resolve) => {
    ze_log('Waiting for deployment done');
    _lifecycle_events.once(_deployment_done, resolve);
  });
}
