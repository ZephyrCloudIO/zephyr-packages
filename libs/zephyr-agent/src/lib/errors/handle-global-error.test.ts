import type { Mock } from '@rstest/core';

import { describe, expect, rs, it, beforeEach, afterEach } from '@rstest/core';
import { handleGlobalError } from './handle-global-error';

const ciInfo = rs.hoisted(() => ({ isCI: false }));

rs.mock('ci-info', () => ciInfo);

rs.mock('../node-persist/storage-keys', () => ({
  StorageKeys: { ze_ci_token: 'ZE_CI_TOKEN' },
}));

rs.mock('../logging/ze-log-event', () => ({
  logFn: rs.fn(),
}));

import { logFn } from '../logging/ze-log-event';

const mockLogFn = logFn as Mock<typeof logFn>;

describe('handleGlobalError', () => {
  const originalEnv = process.env['ZE_FAIL_BUILD'];
  const originalCiToken = process.env['ZE_CI_TOKEN'];

  beforeEach(() => {
    rs.clearAllMocks();
    delete process.env['ZE_FAIL_BUILD'];
    delete process.env['ZE_CI_TOKEN'];
    ciInfo.isCI = false;
  });

  afterEach(() => {
    if (originalCiToken !== undefined) {
      process.env['ZE_CI_TOKEN'] = originalCiToken;
    } else {
      delete process.env['ZE_CI_TOKEN'];
    }
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

  it('should throw when failBuild is true and ZE_FAIL_BUILD is unset', () => {
    const error = new Error('upload failed');

    expect(() => handleGlobalError(error, { failBuild: true })).toThrow('upload failed');
    expect(mockLogFn).not.toHaveBeenCalled();
  });

  it('should log when failBuild is false even if ZE_FAIL_BUILD=true', () => {
    process.env['ZE_FAIL_BUILD'] = 'true';
    const error = new Error('test error');

    handleGlobalError(error, { failBuild: false });

    expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
  });

  describe('token-authenticated CI', () => {
    beforeEach(() => {
      ciInfo.isCI = true;
      process.env['ZE_CI_TOKEN'] = 'test-ci-token';
    });

    it('should throw by default', () => {
      const error = new Error('CI deployment failed');

      expect(() => handleGlobalError(error)).toThrow(error);
      expect(mockLogFn).not.toHaveBeenCalled();
    });

    it('should log when failBuild is explicitly false', () => {
      handleGlobalError(new Error('test error'), { failBuild: false });

      expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
    });

    it('should log when ZE_FAIL_BUILD=false', () => {
      process.env['ZE_FAIL_BUILD'] = 'false';

      handleGlobalError(new Error('test error'));

      expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
    });

    it('should keep non-true ZE_FAIL_BUILD values as explicit opt-outs', () => {
      process.env['ZE_FAIL_BUILD'] = '';

      handleGlobalError(new Error('test error'));

      expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
    });

    it('should throw when failBuild=true overrides ZE_FAIL_BUILD=false', () => {
      process.env['ZE_FAIL_BUILD'] = 'false';
      const error = new Error('CI deployment failed');

      expect(() => handleGlobalError(error, { failBuild: true })).toThrow(error);
      expect(mockLogFn).not.toHaveBeenCalled();
    });

    it('should keep logging in CI without a token', () => {
      delete process.env['ZE_CI_TOKEN'];

      handleGlobalError(new Error('test error'));

      expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
    });

    it('should keep logging in CI with a blank token', () => {
      process.env['ZE_CI_TOKEN'] = '  ';

      handleGlobalError(new Error('test error'));

      expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
    });

    it('should keep logging locally with a token', () => {
      ciInfo.isCI = false;

      handleGlobalError(new Error('test error'));

      expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
    });
  });

  it('should handle unknown error types', () => {
    const error = 'string error';

    handleGlobalError(error);

    expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
  });
});
