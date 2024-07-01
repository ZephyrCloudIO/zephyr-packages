import { request, ze_error } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';

interface GetApplicationHashListProps {
  application_uid: string;
}

export async function getApplicationHashList(props: GetApplicationHashListProps): Promise<{ hashes: string[] }> {
  const { application_uid } = props;
  const { EDGE_URL } = await getApplicationConfiguration({
    application_uid,
  });

  const url = new URL('/__get_application_hash_list__', EDGE_URL);
  url.searchParams.append('application_uid', application_uid);
  const res = await request<{ hashes: string[] }>(url, { method: 'GET' })
    .catch((err) => ze_error("DE20020", 'Failed to get application hash list', err));

  if (!res || typeof res === 'string') {

    // force res to be part of the string  literal
    ze_error("DE20020", `Failed to get application hash list. \n ${res}`);
    return { hashes: [] };
  }

  return res;
}
