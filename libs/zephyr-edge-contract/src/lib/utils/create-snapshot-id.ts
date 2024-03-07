import { createFullAppName } from './create-full-app-name';

export function createSnapshotId(options: {
  app: { org: string; project: string; name: string };
  zeConfig: { user: string; buildId: string | undefined };
}): string {
  const build_id = [options.zeConfig.user, options.zeConfig.buildId].join('_');
  return [build_id, createFullAppName(options.app)].join('.');
}
