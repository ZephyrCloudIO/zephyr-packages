import axios from 'axios';
import { ZE_API_ENDPOINT, ze_api_gateway } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../lib/errors';
import { parseUrl } from '../lib/http/http-request';
import { ze_log } from '../lib/logging';
import { getToken } from '../lib/node-persist/token';
export interface ZeResolvedDependency {
  name: string;
  version: string;

  application_uid: string;
  default_url: string;
  remote_entry_url: string;
  library_type: string;
  platform?: string;
  /** Unique deployment identifier (from __get_version_info__) */
  snapshot_id?: string;
  /** Timestamp when version was published (from __get_version_info__) */
  published_at?: number;
  /** Versioned URL for this specific deployment (from __get_version_info__) */
  version_url?: string;
}

export async function resolve_remote_dependency({
  application_uid,
  version,
  platform,
  build_context,
}: {
  application_uid: string;
  version: string;
  platform?: string;
  build_context: string;
}): Promise<ZeResolvedDependency> {
  const depUrl =
    ZE_API_ENDPOINT() +
    `${ze_api_gateway.resolve}/` +
    `${encodeURIComponent(application_uid)}/` +
    `${encodeURIComponent(version)}`;
  const resolveDependency = parseUrl(depUrl);

  if (platform) {
    resolveDependency.searchParams.append('build_target', platform);
  }

  if (build_context) {
    resolveDependency.searchParams.append('build_context', build_context);
  }

  try {
    ze_log.remotes('URL for resolving dependency:', resolveDependency.toString());

    const token = await getToken();
    const res = await axios.get(resolveDependency.toString(), {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    // used only for error logging
    const [appName, projectName, orgName] = application_uid.split('.');

    // Check response status
    if (res.status < 200 || res.status >= 300) {
      throw new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
        appUid: application_uid,
        appName,
        projectName,
        orgName,
        version,
        data: {
          url: resolveDependency.toString(),
          error: res.data,
        },
      });
    }

    const response = res.data;

    if (response.value) {
      ze_log.remotes(
        'resolved dependency:',
        response.value,
        'application_uid: ',
        application_uid,
        'version: ',
        version
      );
      const resolved = Object.assign({}, response.value, { version, platform });

      // Fetch version info at build time for manifest
      try {
        const versionInfoUrl = new URL('/__get_version_info__', resolved.default_url);
        ze_log.remotes('Fetching version info from:', versionInfoUrl.toString());

        const versionRes = await axios.get(versionInfoUrl.toString(), {
          headers: { Accept: 'application/json' },
          timeout: 5000,
        });

        if (versionRes.status === 200 && versionRes.data) {
          resolved.snapshot_id = versionRes.data.snapshot_id;
          resolved.published_at = versionRes.data.published_at;
          resolved.version_url = versionRes.data.version_url;
          ze_log.remotes('Version info captured:', {
            snapshot_id: resolved.snapshot_id,
            published_at: resolved.published_at,
          });
        }
      } catch (versionError) {
        ze_log.remotes(
          'Warning: Could not fetch version info at build time:',
          ZephyrError.format(versionError)
        );
        // Continue without version info - OTA will still work
      }

      return resolved;
    }

    throw new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
      appUid: application_uid,
      appName,
      projectName,
      orgName,
      version,
      data: { response },
    });
  } catch (cause) {
    if (cause instanceof ZephyrError) throw cause;

    throw new ZephyrError(ZeErrors.ERR_CANNOT_RESOLVE_APP_NAME_WITH_VERSION, {
      version,
      cause,
    });
  }
}
