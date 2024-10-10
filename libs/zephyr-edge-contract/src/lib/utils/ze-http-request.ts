import type { ClientRequestArgs } from 'node:http';
import * as http from 'node:http';
import * as https from 'node:https';
import { ze_error, ze_log } from './debug';
import { cleanTokens } from '../node-persist/token';
import { safe_json_parse } from './safe-json-parse';
import { brightRedBgName } from './debug';
import { red } from './picocolor';
import { ZE_API_ENDPOINT, ZE_IS_PREVIEW, ZEPHYR_API_ENDPOINT } from '../api-contract-negotiation/get-api-contract';

function _redact(str: string | undefined): string {
  if (!str) return '';
  return str.replace(/Bearer ([^"|']+)/gi, 'Bearer [REDACTED]').replace(/"?jwt"?:["|\W']{0,2}([^"|']+)(["|'])/gi, 'jwt: [REDACTED]');
}

export async function request<T = unknown>(
  url: URL,
  options?: ClientRequestArgs,
  data?: unknown & { length: number | undefined }
): Promise<T | string> {
  applyApiHostQueryParam(url);
  const _https = url.protocol !== 'https:' ? http : https;
  return new Promise((resolve, reject) => {
    const req_start = Date.now();
    const _options_str = _redact(JSON.stringify(options));

    const req = _https.request(url, options ?? {}, async (res: http.IncomingMessage) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        await cleanTokens();
        const err = new Error(
          `${brightRedBgName} ${red(`Error [ZE10018]: auth error, please sign in to https://app.zephyr-cloud.io then try to build again. See documentation https://docs.zephyr-cloud.io/errors/ze10018`)}`
        );
        err.stack = void 0;
        throw err;
      }

      const response: Buffer[] = [];
      res.on('data', (d: Buffer) => response.push(d));

      res.on('end', () => {
        const _response = Buffer.concat(response)?.toString();

        const message = _redact(
          `[${options?.method || 'GET'}][${url}]: ${Date.now() - req_start}ms` +
            (data?.length ? ` - ${((data.length ?? 0) / 1024).toFixed(2)}kb` : '') +
            (_response ? `\n response: ${_response}` : '') +
            (_options_str ? `\n options: ${_options_str}` : '')
        );

        if (_response === 'Not Implemented') return reject(message);

        type error_message = { status: number; message?: string };
        const parsed_response = safe_json_parse<error_message>(_response);
        if (
          (typeof res.statusCode === 'number' && res.statusCode > 299) ||
          (typeof parsed_response?.status === 'number' && parsed_response?.status > 299)
        ) {
          return reject(`${brightRedBgName} Error from ${url}: \n ${parsed_response?.message ?? _response}`);
        }

        if (url.pathname.indexOf('application/logs') === -1) ze_log(message);

        resolve((parsed_response as T) ?? (_response as string));
      });
    });

    req.on('error', (e: unknown) => {
      ze_error('ERR_UNKNOWN', `[${options?.method || 'GET'}][${url}]: ${Date.now() - req_start}ms \n ${_options_str} \n ${e}`);
      reject(e);
    });

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

function applyApiHostQueryParam(url: URL) {
  const is_preview = ZE_IS_PREVIEW();
  const ze_api_endpoint = ZE_API_ENDPOINT();
  const zephyr_api_endpoint = ZEPHYR_API_ENDPOINT();
  if (is_preview && url.host === new URL(ze_api_endpoint).host) {
    url.searchParams.set('api_host', zephyr_api_endpoint);
  }
}
