import type {
  StoredVersionInfo,
  ZephyrResolveResponse,
  RemoteVersionInfo,
} from '../types';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('VersionTracker');

/**
 * Compare stored version with resolved version to determine if an update is available
 *
 * @param stored - Previously stored version info (null if first launch)
 * @param resolved - Newly resolved version info from API
 * @returns Whether an update is available
 */
export function hasVersionUpdate(
  stored: StoredVersionInfo | null,
  resolved: ZephyrResolveResponse
): boolean {
  // If no stored version, this is first launch - no update notification
  if (!stored || !stored.version) {
    logger.debug('No stored version, first launch');
    return false;
  }

  // Compare using snapshot_id (version) - this changes with each deploy
  const versionChanged = stored.version !== resolved.version;

  // Also check published_at as a backup comparison
  const publishedAtChanged =
    stored.publishedAt !== undefined &&
    resolved.published_at !== undefined &&
    stored.publishedAt !== resolved.published_at;

  const hasUpdate = versionChanged || publishedAtChanged;

  logger.debug('Version comparison:', {
    storedVersion: stored.version,
    resolvedVersion: resolved.version,
    storedPublishedAt: stored.publishedAt,
    resolvedPublishedAt: resolved.published_at,
    versionChanged,
    publishedAtChanged,
    hasUpdate,
  });

  return hasUpdate;
}

/**
 * Create RemoteVersionInfo from stored and resolved data
 *
 * @param name - Remote name
 * @param stored - Previously stored version info
 * @param resolved - Newly resolved version info from API
 * @returns Remote version info object
 */
export function createRemoteVersionInfo(
  name: string,
  stored: StoredVersionInfo | null,
  resolved: ZephyrResolveResponse
): RemoteVersionInfo {
  return {
    name,
    currentVersion: stored?.version ?? null,
    latestVersion: resolved.version ?? resolved.remote_entry_url,
    remoteEntryUrl: resolved.remote_entry_url,
    hasUpdate: hasVersionUpdate(stored, resolved),
    publishedAt: resolved.published_at,
  };
}

/**
 * Create StoredVersionInfo from resolved data
 *
 * @param resolved - Resolved version info from API
 * @returns Stored version info to persist
 */
export function createStoredVersionInfo(
  resolved: ZephyrResolveResponse
): StoredVersionInfo {
  return {
    version: resolved.version ?? resolved.remote_entry_url,
    url: resolved.remote_entry_url,
    lastUpdated: Date.now(),
    publishedAt: resolved.published_at,
  };
}

/**
 * Filter remotes that have updates available
 *
 * @param remotes - Array of remote version info
 * @returns Array of remotes with updates
 */
export function getRemotesWithUpdates(remotes: RemoteVersionInfo[]): RemoteVersionInfo[] {
  return remotes.filter((remote) => remote.hasUpdate);
}
