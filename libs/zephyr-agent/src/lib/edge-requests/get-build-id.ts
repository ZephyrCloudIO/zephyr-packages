import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { getToken } from '../node-persist/token';
import { getApplicationConfiguration } from './get-application-configuration';

export async function getBuildId(application_uid: string): Promise<string> {
  const { BUILD_ID_ENDPOINT, user_uuid, jwt, username } =
    await getApplicationConfiguration({
      application_uid,
    });

  const token = await getToken();

  const options = {
    headers: {
      can_write_jwt: jwt,
      Authorization: 'Bearer ' + token,
    },
  };

  const [ok, cause, data] = await makeRequest<Record<string, string>>(
    BUILD_ID_ENDPOINT,
    options
  );

  if (!ok || !data[user_uuid]) {
    throw new ZephyrError(ZeErrors.ERR_GET_BUILD_ID, {
      application_uid,
      username,
      cause,
      data,
    });
  }

  ze_log.app('Build ID retrieved...', data);
  return data[user_uuid];
}
