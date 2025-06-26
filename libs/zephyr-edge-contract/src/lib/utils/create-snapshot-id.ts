import { createApplicationUid } from './create-application-uid';

export function createSnapshotId(options: {
  app: { org: string; project: string; name: string };
  target: string;
  zeConfig: { user: string; buildId: string };
}): string {
  // we handle it like this so it trim the user email's domain or their family name out
  const username = options.zeConfig.user.split('_')[0];
  const build_id =
    [username, options.target, options.zeConfig.buildId]
      .filter(Boolean) // handle the case when some values are empty (unlikely but it's possible)
      .join('-')
      .replace(/_/gm, '-') || '-';
  return [build_id, createApplicationUid(options.app)].join('.').toLowerCase();
}

export function flatCreateSnapshotId(props: {
  org: string;
  project: string;
  name: string;
  target: string;
  username: string;
  buildId: string;
}): string {
  // we handle it like this so it trim the user email's domain or their family name out
  const username = props.username.split('_')[0];
  const build_id =
    [username, props.target, props.buildId]
      .filter(Boolean)
      .join('-')
      .replace(/_/gm, '-') || '-';
  return [
    build_id,
    createApplicationUid({
      org: props.org,
      project: props.project,
      name: props.name,
    }),
  ]
    .join('.')
    .toLowerCase();
}
