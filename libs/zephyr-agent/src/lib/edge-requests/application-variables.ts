import {
  type ResolveApplicationVariablesBody,
  type ResolveApplicationVariablesResponse,
  ZE_API_ENDPOINT,
  ze_api_gateway,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ZeHttpRequest } from '../http/ze-http-request';
import { getToken } from '../node-persist/token';

export async function resolveApplicationVariables(
  application_uid: string,
  body: ResolveApplicationVariablesBody
): Promise<ResolveApplicationVariablesResponse> {
  if (!application_uid) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_APPLICATION_UID);
  }

  // Avoids unnecessary requests to the API
  if (!body.names.length) {
    return { variables: [] };
  }

  const token = await getToken();
  const resolve_application_variables_url = new URL(
    `${ze_api_gateway.resolve_application_variables}/${application_uid}`,
    ZE_API_ENDPOINT()
  );

  const [ok, cause, data] = await ZeHttpRequest.from<ResolveApplicationVariablesResponse>(
    resolve_application_variables_url,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_VARIABLES_RESOLUTION, {
      message: 'Got invalid response when trying to resolve new variables',
      cause,
      data,
    });
  }

  return data;
}
