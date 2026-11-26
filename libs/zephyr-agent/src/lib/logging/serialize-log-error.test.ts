import { describe, expect, it } from '@rstest/core';
import { ZeErrors, ZephyrError } from '../errors';
import { createHttpResponseError, createUnreachableError } from '../http/http-failure';
import { serializeLogError } from './serialize-log-error';

describe('serializeLogError', () => {
  it('keeps the ZephyrError code and finds the HTTP status in its cause chain', () => {
    const error = new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'file',
      cause: createHttpResponseError({
        method: 'POST',
        url: 'https://edge.example/upload',
        status: 413,
        content: 'Payload Too Large',
      }),
    });

    expect(serializeLogError(error)).toEqual({
      code: error.code,
      name: 'ZephyrError',
      message: error.message,
      cause_status: 413,
    });
  });

  it('reads the status of an unreachable Zephyr', () => {
    const error = createUnreachableError({
      method: 'GET',
      url: 'https://zeapi.example/resolve',
      failure: 'server_error',
      detail: 'HTTP 503',
      status: 503,
    });

    expect(serializeLogError(error)).toMatchObject({
      code: 'ZE50001',
      cause_status: 503,
    });
  });

  it('omits cause_status when no response caused the error', () => {
    expect(
      serializeLogError(new ZephyrError(ZeErrors.ERR_SNAPSHOT_UPLOADS_NO_RESULTS))
    ).not.toHaveProperty('cause_status');
  });

  it('uses the Node error code of plain errors', () => {
    const error = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });

    expect(serializeLogError(error)).toEqual({
      code: 'ECONNRESET',
      name: 'Error',
      message: 'socket hang up',
    });
  });

  it('falls back to ZE00000 and the class name for other errors', () => {
    class CompilationError extends Error {}

    expect(serializeLogError(new CompilationError('Module not found'))).toEqual({
      code: 'ZE00000',
      name: 'CompilationError',
      message: 'Module not found',
    });
    expect(serializeLogError(new TypeError('x is undefined'))).toMatchObject({
      code: 'ZE00000',
      name: 'TypeError',
    });
  });

  it('ignores non-diagnostic codes, such as an OAuth authorization code', () => {
    const error = Object.assign(new Error('auth failed'), { code: 'abc123-opaque' });
    expect(serializeLogError(error).code).toBe('ZE00000');
  });

  it('serializes thrown non-errors', () => {
    expect(serializeLogError('plain failure')).toEqual({
      code: 'ZE00000',
      name: 'NonError',
      message: 'plain failure',
    });
    expect(serializeLogError({ reason: 'object' })).toMatchObject({
      name: 'NonError',
      message: '{"reason":"object"}',
    });
    expect(serializeLogError(undefined)).toMatchObject({ code: 'ZE00000' });
  });

  it('redacts secrets and strips terminal colors from the message', () => {
    const secret = 'raw-error-signature';
    const error = new Error(
      `\u001b[31mPUT https://uploads.example/file?X-Amz-Signature=${secret} failed\u001b[39m`
    );

    const { message } = serializeLogError(error);
    expect(message).not.toContain(secret);
    expect(message).not.toContain('\u001b[');
    expect(message).toContain('https://uploads.example/file');
  });

  it('bounds very long messages', () => {
    const { message } = serializeLogError(new Error('x'.repeat(10_000)));
    expect(message.length).toBeLessThanOrEqual(2_001);
  });
});
