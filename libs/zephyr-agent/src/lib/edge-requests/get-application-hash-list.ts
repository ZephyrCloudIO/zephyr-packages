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
  // The edge only lists hashes for the application the write token belongs to, so send
  // the same `can_write` token header the upload POSTs use.
  const cfg = await getApplicationConfiguration({
    application_uid,
  });
  const EDGE_URL = edge_url || cfg.EDGE_URL;

  const url = new URL('/__get_application_hash_list__', EDGE_URL);
  url.searchParams.append('application_uid', application_uid);

  const [ok, cause, data] = await makeRequest<{
    hashes: string[];
  }>(url, { method: 'GET', headers: { can_write_jwt: cfg.jwt } });

  // Throw rather than guess: callers decide what a failed list means. Upload paths treat
  // it as empty and upload every asset (contract section 4.1).
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
