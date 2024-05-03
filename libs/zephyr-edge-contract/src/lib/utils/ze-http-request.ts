import type { ClientRequestArgs } from 'node:http';
import * as http from 'node:http';
import * as https from 'node:https';
import { ze_error, ze_log } from './debug';
import { cleanTokens } from '../node-persist/token';
import { safe_json_parse } from './safe-json-parse';

export async function request<T = unknown>(
  url: URL,
  options?: ClientRequestArgs,
  data?: unknown,
): Promise<T | string> {
  const _https = url.protocol !== 'https:' ? http : https;
  return new Promise((resolve, reject) => {
    ze_log(`Requesting ${url}`, `with options: ${JSON.stringify(options)}`);
    const req = _https.request(
      url,
      options ?? {},
      async (res: http.IncomingMessage) => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          await cleanTokens();
          const err = new Error(
            '[zephyr]: auth error, please try to build again',
          );
          err.stack = void 0;
          throw err;
        }

        const response: Buffer[] = [];
        res.on('data', (d: Buffer) => response.push(d));

        res.on('end', () => {
          const _response = Buffer.concat(response)?.toString();
          if (_response === 'Not Implemented')
            return reject(`[zephyr]: Response for ${url} is ${_response}`);

          const parsed_response = safe_json_parse<{ status: number, message?: string }>(_response);
          if ((typeof res.statusCode === 'number' && res.statusCode > 299)
            || (typeof parsed_response?.status === 'number' && parsed_response?.status > 299)) {
            return reject(`[zephyr]: Error from ${url}: \n ${parsed_response?.message ?? _response}`);
          }
          ze_log(`[zephyr]: Response from ${url}`, _response);
          resolve(parsed_response as T ?? _response as string);
        });
      },
    );

    req.on('error', (e: unknown) => {
      ze_error(`[zephyr]: Failed to request ${url.toString()}`, e);
      reject(e);
    });

    if (data) {
      req.write(data);
    }

    req.end();
  });
}
