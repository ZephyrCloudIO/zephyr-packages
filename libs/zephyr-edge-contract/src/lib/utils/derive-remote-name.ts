/**
 * Remote_version is the right-hand side of a remote declaration on a host's Module
 * Federation configuration. E.g.:
 *
 * Remotes: { store_b: store_b@http://localhost:3001/remoteEntry.js }
 */
export function derive_remote_name(remote_version: string, fallback_name: string) {
  const [name] = remote_version.includes('@')
    ? remote_version.split('@')
    : [fallback_name];
  return name;
}
