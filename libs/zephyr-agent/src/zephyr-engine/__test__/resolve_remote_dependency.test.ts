import { describe, expect, jest, it } from '@jest/globals';
import { resolve_remote_dependency } from '../resolve_remote_dependency';
import { ZephyrError } from '../../lib/errors';
import axios from 'axios';

// Mock axios instead of fetch
jest.mock('axios');
const axiosMock = axios as jest.Mocked<typeof axios>;

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
    axiosMock.get.mockReset();
  });

  it('should resolve a remote dependency successfully', async () => {
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    axiosMock.get.mockResolvedValueOnce({
      status: 200,
      data: { value: mock_api_response },
    });

    const result = await resolve_remote_dependency({ application_uid, version });

    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ...mock_api_response, version });
    expect(axiosMock.get).toHaveBeenCalledWith(
      expect.stringContaining(
        `/resolve/${encodeURIComponent(application_uid)}/${encodeURIComponent(version)}`
      ),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
          Accept: 'application/json',
        },
      }
    );
  });

  it('should throw ZephyrError on not ok response', async () => {
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    axiosMock.get.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { message: 'Not found' },
      },
    });

    const promise = resolve_remote_dependency({ application_uid, version });

    await expect(promise).rejects.toThrow(ZephyrError);
    expect(axiosMock.get).toHaveBeenCalled();
  });

  it('should throw ZephyrError when there is no response.value', async () => {
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    axiosMock.get.mockResolvedValueOnce({
      status: 200,
      data: { value: null },
    });

    const promise = resolve_remote_dependency({ application_uid, version });

    await expect(promise).rejects.toThrow(ZephyrError);
    expect(axiosMock.get).toHaveBeenCalled();
  });

  it('throws an error when request fails', async () => {
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    const mockError = new Error('Network Error');
    axiosMock.get.mockRejectedValueOnce(mockError);

    const promise = resolve_remote_dependency({
      application_uid,
      version,
    });

    await expect(promise).rejects.toThrow(ZephyrError);
    expect(axiosMock.get).toHaveBeenCalled();
  });

  it('should show outdated-version error from resolve response headers', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    axiosMock.get.mockResolvedValueOnce({
      status: 200,
      data: { value: mock_api_response },
      headers: {
        'x-zephyr-agent-warning': 'outdated_client',
        'x-zephyr-agent-current-version': '9.9.8',
        'x-zephyr-agent-latest-version': '10.0.0',
      },
    });

    await resolve_remote_dependency({ application_uid, version });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      'Your Zephyr Plugin version is outdated'
    );
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      'If you are facing any issue, upgrade zephyr-packages first.'
    );

    errorSpy.mockRestore();
  });
});
