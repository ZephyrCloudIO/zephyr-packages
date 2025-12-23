import type {
  ZephyrOTAConfig,
  VersionInfo,
  ManifestFetchResult,
  DependencyVersionCheck,
  ZephyrManifest,
  ZephyrDependency,
} from '../types';
import { DEFAULT_OTA_CONFIG } from '../types';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('API');

/** Client for interacting with Zephyr Cloud API using manifest-based flow */
export class ZephyrAPIClient {
  private readonly hostUrl: string;
  private readonly manifestPath: string;
  private readonly authToken: string;

  constructor(config: ZephyrOTAConfig) {
    this.hostUrl = config.hostUrl;
    this.manifestPath = config.manifestPath ?? DEFAULT_OTA_CONFIG.manifestPath;
    this.authToken = config.authToken ?? '';

    if (!this.hostUrl) {
      logger.warn('hostUrl not configured - manifest fetch will fail');
    }
  }

  /** Create headers for API requests */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Fetch the zephyr-manifest.json from the host app's deployed URL
   *
   * @returns Manifest with fetch timestamp, or null if failed
   */
  async fetchManifest(): Promise<ManifestFetchResult | null> {
    if (!this.hostUrl) {
      logger.error('Cannot fetch manifest: hostUrl not configured');
      return null;
    }

    const manifestUrl = new URL(this.manifestPath, this.hostUrl);
    logger.debug(`Fetching manifest from: ${manifestUrl}`);

    try {
      const response = await fetch(manifestUrl.toString(), {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'Cache-Control': 'no-cache', // Always get fresh manifest
        },
      });

      if (!response.ok) {
        logger.warn(`Failed to fetch manifest: ${response.status}`);
        return null;
      }

      const manifest = (await response.json()) as ZephyrManifest;
      logger.debug(
        `Manifest fetched, ${Object.keys(manifest.dependencies || {}).length} dependencies`
      );

      return {
        manifest,
        fetchedAt: Date.now(),
      };
    } catch (error) {
      logger.warn('Error fetching manifest:', error);
      return null;
    }
  }

  /**
   * Fetch version info from a dependency's __get_version_info__ endpoint. This returns the
   * LATEST deployed version for that remote.
   *
   * @param defaultUrl - The default URL for the remote
   * @returns Version info or null if failed
   */
  async fetchVersionInfo(defaultUrl: string): Promise<VersionInfo | null> {
    const url = new URL('/__get_version_info__', defaultUrl);
    logger.debug(`Fetching version info from: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        logger.warn(`Failed to fetch version info: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as VersionInfo;
      logger.debug(`Version info:`, data);

      return data;
    } catch (error) {
      logger.warn(`Error fetching version info:`, error);
      return null;
    }
  }

  /**
   * Check all dependencies in manifest for available updates. Fetches __get_version_info__
   * for each dependency in parallel and compares with manifest's build-time version.
   *
   * @param dependencies - Dependencies from the manifest
   * @returns Map of dependency name to version check result
   */
  async checkDependenciesForUpdates(
    dependencies: Record<string, ZephyrDependency>
  ): Promise<Map<string, DependencyVersionCheck>> {
    const results = new Map<string, DependencyVersionCheck>();

    // Fetch version info for all dependencies in parallel
    const checkPromises = Object.entries(dependencies).map(async ([name, dep]) => {
      const latestVersion = await this.fetchVersionInfo(dep.default_url);

      // Determine if update is available
      let hasUpdate = false;
      if (latestVersion) {
        // Compare snapshot_id (primary) or published_at (fallback)
        if (dep.snapshot_id && latestVersion.snapshot_id) {
          hasUpdate = dep.snapshot_id !== latestVersion.snapshot_id;
        } else if (dep.published_at && latestVersion.published_at) {
          hasUpdate = dep.published_at < latestVersion.published_at;
        }
      }

      return {
        name,
        check: {
          name,
          pinnedVersion: {
            snapshot_id: dep.snapshot_id,
            published_at: dep.published_at,
          },
          latestVersion,
          hasUpdate,
        } as DependencyVersionCheck,
      };
    });

    const checkResults = await Promise.all(checkPromises);

    for (const { name, check } of checkResults) {
      results.set(name, check);
      if (check.hasUpdate) {
        logger.info(
          `Update available for ${name}: ${check.pinnedVersion.snapshot_id} -> ${check.latestVersion?.snapshot_id}`
        );
      }
    }

    return results;
  }
}
