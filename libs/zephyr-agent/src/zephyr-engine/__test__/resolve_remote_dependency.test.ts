import { describe, expect, jest, it } from '@jest/globals';
import { resolve_remote_dependency } from '../resolve_remote_dependency';
import { ZephyrError, ZeErrors } from '../../lib/errors';
import { ZE_API_ENDPOINT } from 'zephyr-edge-contract';

const fetchMock = jest.fn<(...args: unknown[]) => Promise<Response>>();
global.fetch = fetchMock;

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
};

describe('libs/zephyr-agent/src/zephyr-engine/resolve_remote_dependency.ts', () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    fetchMock.mockReset();
  });

  it('should resolve a remote dependency successfully', async () => {
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: mock_api_response }),
    } as Response);

    const result = await resolve_remote_dependency({ application_uid, version });

    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ...mock_api_response, version });
    expect(fetch).toHaveBeenCalledWith(
      new URL(
        `/resolve/${encodeURIComponent(application_uid)}/${encodeURIComponent(version)}`,
        ZE_API_ENDPOINT()
      ),
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
          Accept: 'application/json',
        },
      }
    );
  });

  it('should throw ZephyrError on not ok response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ value: null }),
    } as Response);

    const promise = resolve_remote_dependency({ application_uid, version });

    await expect(promise).rejects.toThrowError(ZephyrError);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('should throw ZephyrError when there is no response.value', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: null }),
    } as Response);

    const promise = resolve_remote_dependency({ application_uid, version });

    await expect(promise).rejects.toThrowError(ZephyrError);

    expect(fetchMock).toHaveBeenCalled();
  });

  it('throws an error when fetch fails', async () => {
    const mockError = new Error('Network Error');
    fetchMock.mockRejectedValue(mockError);

    await expect(
      resolve_remote_dependency({
        application_uid,
        version,
      })
    ).rejects.toThrowError(
      new ZephyrError(ZeErrors.ERR_CANNOT_RESOLVE_APP_NAME_WITH_VERSION, {
        cause: mockError,
      })
    );

    expect(fetch).toHaveBeenCalled();
  });
});
