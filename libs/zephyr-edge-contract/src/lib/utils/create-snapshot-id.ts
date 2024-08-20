import { createApplicationUID } from './create-application-u-i-d';

export function createSnapshotId(options: {
  app: { org: string; project: string; name: string };
  zeConfig: { user: string; buildId: string };
}): string {
  const build_id = [options.zeConfig.user, options.zeConfig.buildId].join('_');
  return [build_id, createApplicationUID(options.app)].join('.');
}
