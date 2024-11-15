import { createApplicationUid } from './create-application-uid';

export function createSnapshotId(options: {
  app: { org: string; project: string; name: string };
  zeConfig: { user: string; buildId: string };
}): string {
  const build_id = [options.zeConfig.user, options.zeConfig.buildId]
    .join('-')
    .replace(/_/gm, '-');
  return [build_id, createApplicationUid(options.app)].join('.');
}

export function flatCreateSnapshotId(props: {
  org: string;
  project: string;
  name: string;
  username: string;
  buildId: string;
}): string {
  const build_id = [props.username, props.buildId].join('_');
  return [
    build_id,
    createApplicationUid({
      org: props.org,
      project: props.project,
      name: props.name,
    }),
  ].join('.');
}
