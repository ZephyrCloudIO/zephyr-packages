import { describe, expect, jest, it, beforeEach, afterEach } from '@jest/globals';
import { catchAsync } from './global-catcher';

jest.mock('../logging/ze-log-event', () => ({
  logFn: jest.fn(),
}));

import { logFn } from '../logging/ze-log-event';

const mockLogFn = logFn as jest.MockedFunction<typeof logFn>;

describe('catchAsync', () => {
  const originalEnv = process.env['ZE_FAIL_BUILD'];

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['ZE_FAIL_BUILD'];
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['ZE_FAIL_BUILD'] = originalEnv;
    } else {
      delete process.env['ZE_FAIL_BUILD'];
    }
  });

  it('should return value on success', async () => {
    const result = await catchAsync(async () => 42);
    expect(result).toBe(42);
    expect(mockLogFn).not.toHaveBeenCalled();
  });

  it('should log error and return undefined when no fallback', async () => {
    const result = await catchAsync(async () => {
      throw new Error('test error');
    });

    expect(result).toBeUndefined();
    expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
  });

  it('should log error and return fallback when provided', async () => {
    const result = await catchAsync(async () => {
      throw new Error('test error');
    }, 'fallback');

    expect(result).toBe('fallback');
    expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
  });

  it('should throw error when ZE_FAIL_BUILD=true', async () => {
    process.env['ZE_FAIL_BUILD'] = 'true';

    await expect(
      catchAsync(async () => {
        throw new Error('build failed');
      })
    ).rejects.toThrow('build failed');

    expect(mockLogFn).not.toHaveBeenCalled();
  });

  it('should log error when ZE_FAIL_BUILD=false', async () => {
    process.env['ZE_FAIL_BUILD'] = 'false';

    const result = await catchAsync(async () => {
      throw new Error('test error');
    });

    expect(result).toBeUndefined();
    expect(mockLogFn).toHaveBeenCalledWith('error', expect.any(String));
  });
});
