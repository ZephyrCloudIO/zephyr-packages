import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  isFileLoggingEnabled: rs.fn(() => false),
  writeLogToFile: rs.fn(),
  debugFactory: rs.fn((namespace: string) =>
    Object.assign(rs.fn(), { enabled: false, namespace })
  ),
}));

rs.mock('debug', () => ({ default: mocks.debugFactory }));
rs.mock('./file-logger', () => ({
  isFileLoggingEnabled: mocks.isFileLoggingEnabled,
  writeLogToFile: mocks.writeLogToFile,
}));

import { ze_log } from './debug';

describe('debug logging', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.isFileLoggingEnabled.mockReturnValue(false);
  });

  it('does not serialize values when debug and file logging are disabled', () => {
    const value = {
      toJSON(): never {
        throw new Error('should not serialize');
      },
    };

    expect(() => ze_log.app(value)).not.toThrow();
    expect(mocks.writeLogToFile).not.toHaveBeenCalled();
  });

  it('safely formats circular values when file logging is enabled', () => {
    mocks.isFileLoggingEnabled.mockReturnValue(true);
    const value: { self?: unknown } = {};
    value.self = value;

    expect(() => ze_log.app(value)).not.toThrow();
    expect(mocks.writeLogToFile).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'debug:app',
        message: '{"self":"[Circular]"}',
      })
    );
  });

  it('redacts presigned URLs and authorization values before file logging', () => {
    mocks.isFileLoggingEnabled.mockReturnValue(true);
    const signature = 'raw-debug-signature';
    const bearer = 'raw-debug-bearer';

    ze_log.http({
      url: `https://uploads.example/file?X-Amz-Signature=${signature}`,
      headers: { Authorization: `Bearer ${bearer}` },
      status: 503,
    });

    const written = mocks.writeLogToFile.mock.calls[0]?.[0];
    expect(written.message).toContain('uploads.example/file');
    expect(written.message).toContain('503');
    expect(written.message).not.toContain(signature);
    expect(written.message).not.toContain(bearer);
  });
});
