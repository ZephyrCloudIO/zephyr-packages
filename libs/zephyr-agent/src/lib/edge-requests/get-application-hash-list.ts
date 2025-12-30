import { getApplicationConfiguration } from './get-application-configuration';
import { makeRequest } from '../http/http-request';
import { ZeErrors, ZephyrError } from '../errors';

interface GetApplicationHashListProps {
  application_uid: string;
  edge_url?: string;
}

export async function getApplicationHashList({
  application_uid,
  edge_url,
}: GetApplicationHashListProps): Promise<{
  hashes: string[];
}> {
  let EDGE_URL = edge_url;
  if (!EDGE_URL) {
    const cfg = await getApplicationConfiguration({
      application_uid,
    });
    EDGE_URL = cfg.EDGE_URL;
  }

  const url = new URL('/__get_application_hash_list__', EDGE_URL);
  url.searchParams.append('application_uid', application_uid);

  const [ok, cause, data] = await makeRequest<{
    hashes: string[];
  }>(url, { method: 'GET' });

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
