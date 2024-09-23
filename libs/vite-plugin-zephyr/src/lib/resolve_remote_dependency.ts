import { getToken, ze_api_gateway, ze_error, ZE_API_ENDPOINT, ze_log } from 'zephyr-edge-contract';

export async function resolve_remote_dependency({ name, version }: { name: string; version: string }): Promise<ResolvedDependency | void> {
  const resolveDependency = new URL(
    `${ze_api_gateway.resolve}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    ZE_API_ENDPOINT()
  );
  ze_log('Resolving dependency', name, version, resolveDependency);
  try {
    const token = await getToken();
    const res = await fetch(resolveDependency, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(res.statusText);
    }
    const response = (await res.json()) as { value: ResolvedDependency } | undefined;
    return response?.value;
  } catch (err) {
    ze_error('ERR_NOT_RESOLVE_APP_NAME_WITH_VERSION', `Could not resolve '${name}' with version '${version}'`);
  }
}

export interface ResolvedDependency {
  remote_name: string;
  default_url: string;
  application_uid: string;
  remote_entry_url: string;
}
