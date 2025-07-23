import axios from 'axios';
import { ZE_API_ENDPOINT, ze_api_gateway } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../lib/errors';
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
  ze_log.remotes(`Resolving remote dependency: ${application_uid}@${version}`);

  const resolveDependency = new URL(
    `${ze_api_gateway.resolve}/${encodeURIComponent(application_uid)}/${encodeURIComponent(version)}`,
    ZE_API_ENDPOINT()
  );

  if (platform) {
    resolveDependency.searchParams.append('build_target', platform);
  }

  if (build_context) {
    resolveDependency.searchParams.append('build_context', build_context);
  }

  try {
    ze_log.remotes(`Dependency resolution URL: ${resolveDependency.toString()}`);

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
      ze_log.remotes(`Dependency resolution failed with status ${res.status}`);
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
      ze_log.remotes(`Successfully resolved dependency ${application_uid}@${version}:`);
      ze_log.remotes(`  - remote_entry_url: ${response.value.remote_entry_url}`);
      ze_log.remotes(`  - default_url: ${response.value.default_url}`);
      ze_log.remotes(`  - library_type: ${response.value.library_type}`);
      return Object.assign({}, response.value, { version, platform });
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
