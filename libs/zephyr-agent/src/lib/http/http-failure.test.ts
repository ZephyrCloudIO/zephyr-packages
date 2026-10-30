import { describe, expect, it } from '@rstest/core';
import { ZeErrors, ZephyrError, getZephyrErrorCategory } from '../errors';
import { redactString } from '../security/redaction';
import {
  createHttpResponseError,
  createUnreachableError,
  isUnreachableStatus,
} from './http-failure';

const url = 'https://api.example.com/v2/thing';

describe('createHttpResponseError', () => {
  it.each([500, 502, 503, 504, 599, 408])(
    'classifies HTTP %i as unreachable (ZE50001)',
    (status) => {
      const error = createHttpResponseError({ method: 'GET', url, status, content: '' });

      expect(ZephyrError.is(error, ZeErrors.ERR_ZEPHYR_UNREACHABLE)).toBe(true);
      expect(error.code).toBe('ZE50001');
      expect(getZephyrErrorCategory(error)).toBe('unreachable');
      expect(error.message).toContain(`HTTP ${status}`);
    }
  );

  it.each([400, 404, 409, 422, 429])(
    'keeps HTTP %i as the stable ERR_HTTP_ERROR (ZE40035)',
    (status) => {
      const error = createHttpResponseError({ method: 'GET', url, status, content: 'x' });

      expect(ZephyrError.is(error, ZeErrors.ERR_HTTP_ERROR)).toBe(true);
      expect(error.code).toBe('ZE40035');
      expect(getZephyrErrorCategory(error)).toBe('config');
    }
  );

  it('never says "check your network connection" for an HTTP response', () => {
    for (const status of [400, 404, 500, 503]) {
      const error = createHttpResponseError({ method: 'GET', url, status, content: '' });
      expect(error.message.toLowerCase()).not.toContain('network connection');
    }
  });

  it('gives a 503 response and a refused connection the same code and category', () => {
    const fromStatus = createHttpResponseError({
      method: 'GET',
      url,
      status: 503,
      content: '',
    });
    const fromNetwork = createUnreachableError({
      method: 'GET',
      url,
      failure: 'network',
      detail: 'The request failed after retries (ECONNREFUSED)',
    });

    expect(fromStatus.code).toBe(fromNetwork.code);
    expect(getZephyrErrorCategory(fromStatus)).toBe(getZephyrErrorCategory(fromNetwork));
  });

  it('prints the status code in the formatted message', () => {
    const error = createHttpResponseError({
      method: 'GET',
      url,
      status: 404,
      content: '',
    });

    expect(redactString(error.message)).toContain('status code 404');
    expect(redactString(error.message)).not.toContain('[REDACTED]');
  });

  it('records the failure kind and status in the error data', () => {
    const error = createHttpResponseError({
      method: 'GET',
      url,
      status: 503,
      content: '{"message":"down"}',
    });

    expect(error.data).toEqual({
      failure: 'server_error',
      status: 503,
      response: '{"message":"down"}',
    });
  });
});

describe('isUnreachableStatus', () => {
  it('is true for 5xx and 408 only', () => {
    expect(isUnreachableStatus(500)).toBe(true);
    expect(isUnreachableStatus(408)).toBe(true);
    expect(isUnreachableStatus(499)).toBe(false);
    expect(isUnreachableStatus(401)).toBe(false);
    expect(isUnreachableStatus(200)).toBe(false);
  });
});

describe('unreachable message after redaction', () => {
  it('keeps the detail when the URL has a query string', () => {
    const error = createHttpResponseError({
      method: 'GET',
      url: 'https://api.example.com/resolve?build_context=abc',
      status: 503,
      content: '',
    });

    const message = redactString(error.message);

    expect(message).toContain('HTTP 503');
    expect(message).toContain('Request: GET https://api.example.com/resolve');
    expect(redactString(message)).toBe(message);
  });
});
