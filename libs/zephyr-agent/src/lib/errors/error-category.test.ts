import { describe, expect, it } from '@rstest/core';
import {
  getZephyrErrorCategory,
  getZephyrErrorCodeCategory,
  isZephyrUnreachableError,
} from './error-category';
import { ZeErrors } from './codes';
import { ZephyrError } from './zephyr-error';

describe('getZephyrErrorCategory', () => {
  it('reports the unreachable class for ZE50001', () => {
    const error = new ZephyrError(ZeErrors.ERR_ZEPHYR_UNREACHABLE, {
      method: 'GET',
      url: 'https://api.example.com/',
      detail: 'HTTP 503',
      hint: 'Try again later.',
    });

    expect(error.code).toBe('ZE50001');
    expect(getZephyrErrorCategory(error)).toBe('unreachable');
    expect(isZephyrUnreachableError(error)).toBe(true);
  });

  it('keeps unreachable apart from auth, forbidden and config', () => {
    expect(getZephyrErrorCodeCategory('ZE10018')).toBe('auth');
    expect(getZephyrErrorCodeCategory('ZE10037')).toBe('auth');
    expect(getZephyrErrorCodeCategory('ZE10022')).toBe('forbidden');
    expect(getZephyrErrorCodeCategory('ZE40035')).toBe('config');
    expect(getZephyrErrorCodeCategory('ZE40002')).toBe('config');
    expect(getZephyrErrorCodeCategory('ZE50001')).toBe('unreachable');
    expect(getZephyrErrorCodeCategory('ZE20014')).toBe('deploy');
  });

  it('reads the category from the root cause of a wrapped error', () => {
    const cause = new ZephyrError(ZeErrors.ERR_ZEPHYR_UNREACHABLE, {
      method: 'GET',
      url: 'https://api.example.com/',
      detail: 'HTTP 503',
      hint: 'Try again later.',
    });
    const wrapper = new ZephyrError(ZeErrors.ERR_LOAD_APP_CONFIG, {
      application_uid: 'app.project.org',
      cause,
    });

    expect(wrapper.code).toBe('ZE20014');
    expect(wrapper.reason).toBe('ZE50001');
    expect(getZephyrErrorCategory(wrapper)).toBe('unreachable');
  });

  it('does not report auth failures as unreachable', () => {
    const error = new ZephyrError(ZeErrors.ERR_AUTH_ERROR, { message: 'expired' });

    expect(getZephyrErrorCategory(error)).toBe('auth');
    expect(isZephyrUnreachableError(error)).toBe(false);
  });

  it('is unknown for non-Zephyr errors and unknown codes', () => {
    expect(getZephyrErrorCategory(new Error('boom'))).toBe('unknown');
    expect(getZephyrErrorCategory(undefined)).toBe('unknown');
    expect(getZephyrErrorCodeCategory('ZE99999' as never)).toBe('unknown');
    expect(getZephyrErrorCodeCategory('ZE00000')).toBe('unknown');
  });

  it('never changes an existing error code when a kind is added', () => {
    expect(ZephyrError.toZeCode(ZeErrors.ERR_HTTP_ERROR)).toBe('ZE40035');
    expect(ZephyrError.toZeCode(ZeErrors.ERR_LOAD_APP_CONFIG)).toBe('ZE20014');
    expect(ZephyrError.toZeCode(ZeErrors.ERR_CANNOT_RESOLVE_APP_NAME_WITH_VERSION)).toBe(
      'ZE40003'
    );
  });
});
