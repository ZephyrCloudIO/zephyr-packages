import { createApplicationUid } from './create-application-uid';

export function createSnapshotId(options: {
  app: { org: string; project: string; name: string };
  target: string;
  zeConfig: { user: string; buildId: string };
}): string {
  // we handle it like this so it trim the user email's domain or their family name out
  const target = options.target !== 'web' ? options.target : null;
  const build_id =
    [options.zeConfig.user, target, options.zeConfig.buildId]
      .filter(Boolean) // handle the case when some values are empty (unlikely but it's possible)
      .join('-')
      .replace(/_/gm, '-') || '-';
  return [build_id, createApplicationUid(options.app)].join('.');
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
  const target = props.target !== 'web' ? props.target : null;
  const build_id =
    [props.username, target, props.buildId]
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
  ].join('.');
}
