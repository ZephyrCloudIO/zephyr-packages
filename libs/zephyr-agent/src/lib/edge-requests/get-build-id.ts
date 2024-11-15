import { getApplicationConfiguration } from './get-application-configuration';
import { getToken } from '../node-persist/token';
import { ZeHttpRequest } from '../http/ze-http-request';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';

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

  const [ok, cause, data] = await ZeHttpRequest.from<Record<string, string>>(
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

  ze_log('Build ID retrieved...', data);
  return data[user_uuid];
}
