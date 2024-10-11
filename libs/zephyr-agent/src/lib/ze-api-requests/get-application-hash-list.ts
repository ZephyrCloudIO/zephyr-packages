import { ZeErrors, ZeHttpRequest, ZephyrError } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';

interface GetApplicationHashListProps {
  application_uid: string;
}

export async function getApplicationHashList({ application_uid }: GetApplicationHashListProps): Promise<{ hashes: string[] }> {
  const { EDGE_URL } = await getApplicationConfiguration({
    application_uid,
  });

  const url = new URL('/__get_application_hash_list__', EDGE_URL);
  url.searchParams.append('application_uid', application_uid);

  const [ok, cause, data] = await ZeHttpRequest.from<{ hashes: string[] }>(url, { method: 'GET' });

  // No point into returning an empty array since if this request fails
  // means the edge is not working properly and we won't be able to upload
  // things anyway
  if (!ok || !data?.hashes) {
    throw new ZephyrError(ZeErrors.ERR_GET_APPLICATION_HASH_LIST, {
      cause,
      data: {
        ...data,
        url: url.toString(),
      },
    });
  }

  return data;
}
