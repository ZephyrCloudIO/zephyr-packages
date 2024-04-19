import * as http from 'node:http';
import * as https from 'node:https';
import type {ClientRequestArgs} from 'node:http';
import { ze_error, ze_log } from './debug';
import { cleanTokens } from '../node-persist/token';

export async function request<T = unknown>(
  _url: string | URL,
  options?: ClientRequestArgs,
  data?: unknown,
): Promise<T | string> {
  const url = _url instanceof URL ? _url : new URL(_url);
  const _https = url.protocol !== 'https:' ? http : https;
  return new Promise((resolve, reject) => {
    ze_log(`Requesting ${url}`, `with options: ${JSON.stringify(options)}`);
    const req = _https.request(url, options ?? {}, async (res: http.IncomingMessage) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        await cleanTokens();
        const err = new Error('[zephyr]: auth error, please try to build again');
        err.stack = void 0;
        throw err;
      }

      const response: Buffer[] = [];
      res.on('data', (d: Buffer) => response.push(d));

      res.on('end', () => {
        const _response = Buffer.concat(response)?.toString();
        ze_log(`Response from ${url}`, _response);
        try {
          resolve(JSON.parse(_response));
        } catch {
          resolve(_response);
        }
      });
    });

    req.on('error', (e: unknown) => {
      ze_error(`Failed to request ${url.toString()}`, e);
      reject(e);
    });

    if (data) {
      req.write(data);
    }

    req.end();
  });
}
