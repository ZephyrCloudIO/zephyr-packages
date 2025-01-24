import { ZE_API_ENDPOINT, ze_api_gateway } from 'zephyr-edge-contract';
import { getToken } from '../lib/node-persist/token';
import { ZeErrors, ZephyrError } from '../lib/errors';
import { ze_log } from '../lib/logging';

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
}: {
  application_uid: string;
  version: string;
  platform?: string;
}): Promise<ZeResolvedDependency> {
  const resolveDependency = new URL(
    `${ze_api_gateway.resolve}/${encodeURIComponent(application_uid)}/${encodeURIComponent(version)}`,
    ZE_API_ENDPOINT()
  );

  if (platform) {
    resolveDependency.searchParams.append('build_target', platform);
  }

  try {
    ze_log('URL for resolving dependency:', resolveDependency.toString());

    const token = await getToken();
    const res = await fetch(resolveDependency, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
    });

    const [appName, projectName, orgName] = application_uid.split('.');

    if (!res.ok) {
      throw new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
        appUid: application_uid,
        appName,
        projectName,
        orgName,
        data: {
          url: resolveDependency.toString(),
          version,
          error: await res.json().catch(() => res.text()),
        },
      });
    }

    const response = await res.json();

    if (response.value) {
      ze_log(
        'resolved dependency:',
        response.value,
        'application_uid: ',
        application_uid,
        'version: ',
        version
      );
      return Object.assign({}, response.value, { version, platform });
    }

    throw new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
      appUid: application_uid,
      appName,
      projectName,
      orgName,
      data: { version, response },
    });
  } catch (cause) {
    if (cause instanceof ZephyrError) throw cause;

    throw new ZephyrError(ZeErrors.ERR_CANNOT_RESOLVE_APP_NAME_WITH_VERSION, {
      data: { version },
      cause,
    });
  }
}
