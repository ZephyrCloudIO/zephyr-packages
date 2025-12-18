import type {
  ZephyrOTAConfig,
  ZephyrResolveResponse,
  VersionInfo,
  ApiResponseWrapper,
  ParsedZephyrDependency,
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

    const url = `${this.apiBaseUrl}/resolve/${encodeURIComponent(
      applicationUid
    )}/${encodeURIComponent(versionTag)}?build_target=${buildTarget}`;

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
    const url = `${defaultUrl}/__get_version_info__`;
    logger.debug(`Fetching version info from: ${url}`);

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
}

/** Create a new API client instance */
export function createAPIClient(config: ZephyrOTAConfig): ZephyrAPIClient {
  return new ZephyrAPIClient(config);
}
