/**
 * Remote_version is the right-hand side of a remote declaration on a host's Module
 * Federation configuration. E.g.:
 *
 * Remotes: { store_b: store_b@http://localhost:3001/remoteEntry.js }
 */
export function parse_remote_app_name(remote_version: string): string | undefined {
  const [name] = remote_version.includes('@') ? remote_version.split('@') : [];
  return name;
}
