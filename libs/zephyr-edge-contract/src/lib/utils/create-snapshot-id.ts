import { createApplicationUid } from './create-application-uid';

export function createSnapshotId(options: {
  app: { org: string; project: string; name: string };
  target: string;
  zeConfig: { user: string; buildId: string };
}): string {
  // Only include target in ID if it's not the default 'web' platform
  const target = options.target === 'web' ? null : options.target;
  const build_id =
    [options.zeConfig.user, target, options.zeConfig.buildId]
      .filter(Boolean) // handle the case when some values are empty (unlikely but it's possible)
      .join('-')
      .replace(/_/gm, '-')
      .toLowerCase() || '-';
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
  // Only include target in ID if it's not the default 'web' platform
  const target = props.target === 'web' ? null : props.target;
  const build_id =
    [props.username, target, props.buildId]
      .filter(Boolean)
      .join('-')
      .replace(/_/gm, '-') // Replace underscores with hyphens
      .toLowerCase() || '-'; // Convert to lowercase
  return [
    build_id,
    createApplicationUid({
      org: props.org,
      project: props.project,
      name: props.name,
    }),
  ].join('.');
}
