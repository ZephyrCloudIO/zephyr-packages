import { describe, expect, jest, it } from '@jest/globals';
import { resolve_remote_dependency } from '../resolve_remote_dependency';
import { ZephyrError } from '../../lib/errors';

const makeRequestMock = jest.fn();
const withTelemetrySpanMock = jest.fn(async (_name, work) => work(undefined));

jest.mock('../../lib/http/http-request', () => ({
  parseUrl: (url: string) => new URL(url),
  makeRequest: (...args: unknown[]) => makeRequestMock(...args),
}));

jest.mock('../../lib/telemetry', () => ({
  withTelemetrySpan: (
    name: string,
    work: unknown,
    attributes?: unknown,
    kind?: unknown
  ) => withTelemetrySpanMock(name, work, attributes, kind),
}));

const mockToken = 'test-token';
const getTokenMock = jest.fn();
jest.mock('../../lib/node-persist/token', () => ({
  getToken: () => getTokenMock(),
}));

const application_uid = 'test_app.test_project.test_organization';
const version = 'test-app-version';
const mock_api_response = {
  name: 'test_app',
  application_uid,
  default_url: 'https://test.default.com',
  remote_entry_url: 'https://test.default.com/remoteEntry.js',
  library_type: 'module',
};

describe('libs/zephyr-agent/src/zephyr-engine/resolve_remote_dependency.ts', () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    makeRequestMock.mockReset();
    withTelemetrySpanMock.mockClear();
  });

  it('should resolve a remote dependency successfully', async () => {
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    makeRequestMock.mockResolvedValueOnce([true, null, { value: mock_api_response }]);

    const result = await resolve_remote_dependency({
      application_uid,
      version,
      build_context: '',
    });

    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ...mock_api_response, version, platform: undefined });
    expect(withTelemetrySpanMock).toHaveBeenCalledTimes(1);
    expect(makeRequestMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
          Accept: 'application/json',
        },
      })
    );
  });

  it('should throw ZephyrError on non-ok response', async () => {
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    makeRequestMock.mockResolvedValueOnce([false, new Error('Not found')]);

    const promise = resolve_remote_dependency({
      application_uid,
      version,
      build_context: '',
    });

    await expect(promise).rejects.toThrow(ZephyrError);
    expect(makeRequestMock).toHaveBeenCalled();
  });

  it('should throw ZephyrError when there is no response.value', async () => {
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    makeRequestMock.mockResolvedValueOnce([true, null, { value: null }]);

    const promise = resolve_remote_dependency({
      application_uid,
      version,
      build_context: '',
    });

    await expect(promise).rejects.toThrow(ZephyrError);
    expect(makeRequestMock).toHaveBeenCalled();
  });

  it('throws an error when request fails', async () => {
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    const mockError = new Error('Network Error');
    makeRequestMock.mockRejectedValueOnce(mockError);

    const promise = resolve_remote_dependency({
      application_uid,
      version,
      build_context: '',
    });

    await expect(promise).rejects.toThrow(ZephyrError);
    expect(makeRequestMock).toHaveBeenCalled();
  });
});
