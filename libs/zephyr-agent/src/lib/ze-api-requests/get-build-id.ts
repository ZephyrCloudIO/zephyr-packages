import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';
import { getToken, request, ze_error } from 'zephyr-edge-contract';

export async function getBuildId(
  application_uid: string
): Promise<string | void> {
  const { BUILD_ID_ENDPOINT, user_uuid, jwt } =
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

  type BuildIdResp =
    | string
    | Record<string, string>
    | { status: number; message: string };

  try {
    const resp = await request<BuildIdResp>(
      new URL(BUILD_ID_ENDPOINT),
      options
    )


    if (typeof resp === 'string') {
      throw new Error('[get_build_id]: ' + resp);
    }
    if (!resp || (typeof resp.status === 'number' && resp.status !== 200)) {
      throw new Error('[get_build_id]: resp.message: ' + resp.message);
    }

    return (resp as Record<string, string>)[user_uuid];
  } catch (err: unknown) {
    ze_error('Failed to get build id', err);
  }
}
