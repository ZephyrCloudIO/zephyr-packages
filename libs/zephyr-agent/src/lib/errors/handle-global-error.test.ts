import type { Mock } from '@rstest/core';

import { describe, expect, rs, it, beforeEach, afterEach } from '@rstest/core';
import { handleGlobalError } from './handle-global-error';

rs.mock('../logging/ze-log-event', () => ({
  logFn: rs.fn(),
}));

import { logFn } from '../logging/ze-log-event';

const mockLogFn = logFn as Mock<typeof logFn>;

describe('handleGlobalError', () => {
  const originalEnv = process.env['ZE_FAIL_BUILD'];

  beforeEach(() => {
    rs.clearAllMocks();
    delete process.env['ZE_FAIL_BUILD'];
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['ZE_FAIL_BUILD'] = originalEnv;
    } else {
      delete process.env['ZE_FAIL_BUILD'];
    }
  });

  it('should log error when ZE_FAIL_BUILD is not set', () => {
    const error = new Error('test error');

    handleGlobalError(error);

    expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
  });

  it('should throw error when ZE_FAIL_BUILD=true', () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const error = new Error('build failed');

    expect(() => handleGlobalError(error)).toThrow('build failed');
    expect(mockLogFn).not.toHaveBeenCalled();
  });

  it('should log error when ZE_FAIL_BUILD=false', () => {
    process.env['ZE_FAIL_BUILD'] = 'false';
    const error = new Error('test error');

    handleGlobalError(error);

    expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
  });

  it('should handle unknown error types', () => {
    const error = 'string error';

    handleGlobalError(error);

    expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
  });
});
