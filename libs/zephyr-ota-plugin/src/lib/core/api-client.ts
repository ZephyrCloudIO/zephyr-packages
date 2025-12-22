import type {
  ZephyrOTAConfig,
  ZephyrResolveResponse,
  VersionInfo,
  ApiResponseWrapper,
  ParsedZephyrDependency,
  BatchResolveRequest,
  BatchResolveResponse,
} from '../types';
import { DEFAULT_OTA_CONFIG } from '../types';
import { getBuildTarget } from '../utils/platform';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('API');

/** Client for interacting with Zephyr Cloud API */
export class ZephyrAPIClient {
  private readonly apiBaseUrl: string;
  private readonly authToken: string;

  constructor(config: ZephyrOTAConfig) {
    this.apiBaseUrl = config.apiBaseUrl ?? DEFAULT_OTA_CONFIG.apiBaseUrl;
    this.authToken = config.authToken ?? '';
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
   * Resolve a remote's information from Zephyr Cloud
   *
   * @param dependency - Parsed zephyr dependency
   * @returns Resolved remote info or null if failed
   */
  async resolveRemote(
    dependency: ParsedZephyrDependency
  ): Promise<ZephyrResolveResponse | null> {
    const { applicationUid, versionTag, name } = dependency;
    const buildTarget = getBuildTarget();

    const url = new URL(
      `/resolve/${encodeURIComponent(applicationUid)}/${encodeURIComponent(versionTag)}`,
      this.apiBaseUrl
    );
    url.searchParams.set('build_target', buildTarget);

    logger.debug(`Resolving ${name} from: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      logger.debug(`Response status for ${name}: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`Failed to resolve ${applicationUid}: ${response.status}`, errorText);
        return null;
      }

      const data = (await response.json()) as
        | ApiResponseWrapper<ZephyrResolveResponse>
        | ZephyrResolveResponse;

      // API returns data nested under .value
      const resolved: ZephyrResolveResponse = 'value' in data ? data.value : data;

      logger.debug(`Resolved data for ${name}:`, resolved);

      // Fetch actual version info from /__get_version_info__ endpoint
      const versionInfo = await this.fetchVersionInfo(resolved.default_url);

      if (versionInfo) {
        // Use snapshot_id as the version identifier (changes with each deploy)
        resolved.version = versionInfo.snapshot_id;
        resolved.published_at = versionInfo.published_at;
        resolved.version_url = versionInfo.version_url;
        logger.debug(`Using version info for ${name}:`, {
          snapshot_id: versionInfo.snapshot_id,
          published_at: versionInfo.published_at,
        });
      } else {
        // Fallback to remote_entry_url if version info not available
        logger.warn(`Version info not available for ${name}, falling back to URL`);
        if (!resolved.version && resolved.remote_entry_url) {
          resolved.version = resolved.remote_entry_url;
        }
      }

      return resolved;
    } catch (error) {
      logger.warn(`Error resolving ${applicationUid}:`, error);
      return null;
    }
  }

  /**
   * Fetch version info from the /**get_version_info** endpoint This returns the actual
   * deployed version metadata (snapshot_id, published_at) which changes with each
   * deployment
   *
   * @param defaultUrl - The default URL for the remote
   * @returns Version info or null if failed
   */
  async fetchVersionInfo(defaultUrl: string): Promise<VersionInfo | null> {
    const url = new URL('/__get_version_info__', defaultUrl);
    logger.debug(`Fetching version info from: ${url.toString()}`);

    try {
      const response = await fetch(url, {
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
   * Resolve multiple remotes in a single batch request
   *
   * @param dependencies - Array of parsed zephyr dependencies
   * @returns Map of dependency name to resolved info (or null if failed)
   */
  async resolveRemotesBatch(
    dependencies: ParsedZephyrDependency[]
  ): Promise<Map<string, ZephyrResolveResponse | null>> {
    const buildTarget = getBuildTarget();
    const results = new Map<string, ZephyrResolveResponse | null>();

    if (dependencies.length === 0) {
      return results;
    }

    // Build batch request
    const batchRequest: BatchResolveRequest = {
      dependencies: dependencies.map((dep) => ({
        applicationUid: dep.applicationUid,
        versionTag: dep.versionTag,
      })),
    };

    const url = new URL('/resolve/batch', this.apiBaseUrl);
    url.searchParams.set('build_target', buildTarget);

    logger.debug(`Batch resolving ${dependencies.length} dependencies from: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchRequest),
      });

      logger.debug(`Batch response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`Batch resolve failed: ${response.status}`, errorText);

        // Fall back to individual requests
        logger.debug('Falling back to individual resolve requests');
        return this.resolveRemotesIndividually(dependencies);
      }

      const data = (await response.json()) as BatchResolveResponse;

      // Create a lookup map from applicationUid+versionTag to dependency name
      const depLookup = new Map<string, string>();
      for (const dep of dependencies) {
        depLookup.set(`${dep.applicationUid}@${dep.versionTag}`, dep.name);
      }

      // Process batch results and fetch version info in parallel
      const versionInfoPromises: Array<{
        name: string;
        resolved: ZephyrResolveResponse;
        promise: Promise<VersionInfo | null>;
      }> = [];

      for (const item of data.results) {
        const key = `${item.applicationUid}@${item.versionTag}`;
        const depName = depLookup.get(key);

        if (!depName) {
          logger.warn(`Unknown dependency in batch response: ${key}`);
          continue;
        }

        if (item.error) {
          logger.warn(`Batch resolve error for ${depName}: ${item.error}`);
          results.set(depName, null);
          continue;
        }

        if (item.resolved) {
          logger.debug(`Batch resolved ${depName}:`, item.resolved);
          versionInfoPromises.push({
            name: depName,
            resolved: item.resolved,
            promise: this.fetchVersionInfo(item.resolved.default_url),
          });
        } else {
          results.set(depName, null);
        }
      }

      // Await all version info fetches in parallel
      const versionInfoResults = await Promise.all(
        versionInfoPromises.map(async ({ name, resolved, promise }) => {
          const versionInfo = await promise;
          return { name, resolved, versionInfo };
        })
      );

      // Apply version info to resolved data
      for (const { name, resolved, versionInfo } of versionInfoResults) {
        if (versionInfo) {
          resolved.version = versionInfo.snapshot_id;
          resolved.published_at = versionInfo.published_at;
          resolved.version_url = versionInfo.version_url;
          logger.debug(`Version info for ${name}:`, {
            snapshot_id: versionInfo.snapshot_id,
            published_at: versionInfo.published_at,
          });
        } else {
          logger.warn(`Version info not available for ${name}, falling back to URL`);
          if (!resolved.version && resolved.remote_entry_url) {
            resolved.version = resolved.remote_entry_url;
          }
        }
        results.set(name, resolved);
      }

      return results;
    } catch (error) {
      logger.warn('Error in batch resolve:', error);
      // Fall back to individual requests
      logger.debug('Falling back to individual resolve requests');
      return this.resolveRemotesIndividually(dependencies);
    }
  }

  /** Fallback method to resolve remotes individually when batch fails */
  private async resolveRemotesIndividually(
    dependencies: ParsedZephyrDependency[]
  ): Promise<Map<string, ZephyrResolveResponse | null>> {
    const results = new Map<string, ZephyrResolveResponse | null>();

    // Resolve all in parallel
    const resolvePromises = dependencies.map(async (dep) => {
      const resolved = await this.resolveRemote(dep);
      return { name: dep.name, resolved };
    });

    const resolveResults = await Promise.all(resolvePromises);

    for (const { name, resolved } of resolveResults) {
      results.set(name, resolved);
    }

    return results;
  }
}
