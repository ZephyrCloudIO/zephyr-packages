import { readFileSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from '@rstest/core';
import { stripAnsi } from 'zephyr-edge-contract';
import { ZeErrors } from './codes';
import { ZephyrError } from './zephyr-error';

describe('ZephyrError security serialization', () => {
  const temporaryFiles: string[] = [];

  afterEach(() => {
    for (const file of temporaryFiles.splice(0)) {
      rmSync(file, { force: true });
    }
  });

  it('redacts circular causes and query/header secrets from output and detail files', () => {
    const signature = 'raw-error-signature';
    const token = 'raw-error-token';
    const state = 'raw-error-state';
    const cause = new Error(
      `upload failed https://uploads.example/file?X-Amz-Signature=${signature}`
    ) as Error & { headers?: unknown; self?: unknown };
    cause.headers = { Authorization: `Bearer ${token}` };
    cause.self = cause;
    const error = new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `authorization state=${state} failed`,
      cause,
      data: {
        status: 503,
        callback: `https://auth.example/callback?state=${state}`,
        accessToken: token,
      },
    });

    const formatted = stripAnsi(ZephyrError.format(error));
    const serialized = JSON.stringify(error);
    const file = formatted.match(/Complete error details available at (.+\.json)/u)?.[1];

    expect(file).toBeDefined();
    temporaryFiles.push(file as string);
    const details = readFileSync(file as string, 'utf8');
    for (const output of [formatted, serialized, details]) {
      expect(output).toContain('503');
      expect(output).not.toContain(signature);
      expect(output).not.toContain(token);
      expect(output).not.toContain(state);
    }
    expect(details).toContain('[Circular]');
  });
});
