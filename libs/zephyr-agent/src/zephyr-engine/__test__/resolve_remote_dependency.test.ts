import { beforeEach } from '@rstest/core';
import type { Mocked } from '@rstest/core';

import { describe, expect, rs, it } from '@rstest/core';
import {
  RESOLVE_REMOTE_DEPENDENCY_DEADLINE_MS,
  resolve_remote_dependency,
} from '../resolve_remote_dependency';
import { ZeErrors, ZephyrError, getZephyrErrorCategory } from '../../lib/errors';
import { fetchWithRetries } from '../../lib/http/fetch-with-retries';
import { createUnreachableError } from '../../lib/http/http-failure';

rs.mock('../../lib/http/fetch-with-retries', { spy: true });
const fetchMock = fetchWithRetries as Mocked<typeof fetchWithRetries>;

const mockToken = 'test-token';
const getTokenMock = rs.fn();
rs.mock('../../lib/node-persist/token', () => ({
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

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

function requestedUrl(call = 0): URL {
  return fetchMock.mock.calls[call][0] as URL;
}

describe('libs/zephyr-agent/src/zephyr-engine/resolve_remote_dependency.ts', () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    getTokenMock.mockImplementation(() => Promise.resolve(mockToken));
    fetchMock.mockReset();
  });

  it('should resolve a remote dependency successfully', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { value: mock_api_response }));

    const result = await resolve_remote_dependency({
      application_uid,
      version,
      build_context: 'local',
    });

    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ...mock_api_response, version });
    expect(requestedUrl().pathname).toContain(
      `/resolve/${encodeURIComponent(application_uid)}/${encodeURIComponent(version)}`
    );
    expect(fetchMock.mock.calls[0][1]).toEqual({
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mockToken}`,
        Accept: 'application/json',
      },
    });
  });

  it('bounds every lookup with a deadline so a silent gateway cannot stall the build', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { value: mock_api_response }));

    await resolve_remote_dependency({ application_uid, version, build_context: 'local' });

    expect(RESOLVE_REMOTE_DEPENDENCY_DEADLINE_MS).toBeGreaterThan(0);
    expect(RESOLVE_REMOTE_DEPENDENCY_DEADLINE_MS).toBeLessThanOrEqual(30_000);
    // (url, options, retries, deadlineMs): the retry count keeps its default.
    expect(fetchMock.mock.calls[0][2]).toBeUndefined();
    expect(fetchMock.mock.calls[0][3]).toBe(RESOLVE_REMOTE_DEPENDENCY_DEADLINE_MS);
  });

  it('sends tap-app as the dependency build target', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { value: mock_api_response }));

    await resolve_remote_dependency({
      application_uid,
      version,
      platform: 'tap-app',
      build_context: 'local',
    });

    expect(requestedUrl().searchParams.get('build_target')).toBe('tap-app');
    expect(requestedUrl().searchParams.get('build_context')).toBe('local');
  });

  it('requests immutable version URLs when configured', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { value: mock_api_response }));

    await resolve_remote_dependency({
      application_uid,
      version,
      build_context: 'local',
      dependencyUrlMode: 'version',
    });

    expect(requestedUrl().searchParams.get('url_mode')).toBe('version');
  });

  it('omits the URL mode when the default selector behavior is used', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { value: mock_api_response }));

    await resolve_remote_dependency({ application_uid, version, build_context: 'local' });

    expect(requestedUrl().searchParams.has('url_mode')).toBe(false);
  });

  it('rejects an unsupported target before making a dependency request', async () => {
    await expect(
      resolve_remote_dependency({
        application_uid,
        version,
        platform: 'desktop' as never,
        build_context: 'local',
      })
    ).rejects.toThrow('resolve_remote_dependency({ platform }) must be one of');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps a 404 as a remote resolution error, not an outage', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: 'Not found' }));

    const error = await resolve_remote_dependency({
      application_uid,
      version,
      build_context: 'local',
    }).catch((caught: unknown) => caught);

    expect(ZephyrError.is(error, ZeErrors.ERR_RESOLVE_REMOTES)).toBe(true);
    expect(getZephyrErrorCategory(error)).toBe('config');
  });

  it('reports a 503 from /resolve as unreachable, not as a missing remote', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, { message: 'Unavailable' }));

    const error = await resolve_remote_dependency({
      application_uid,
      version,
      build_context: 'local',
    }).catch((caught: unknown) => caught);

    expect(ZephyrError.is(error, ZeErrors.ERR_ZEPHYR_UNREACHABLE)).toBe(true);
    expect(getZephyrErrorCategory(error)).toBe('unreachable');
    expect((error as Error).message).not.toContain('has not been built');
  });

  it('passes through the unreachable error raised for a network failure or timeout', async () => {
    const unreachable = createUnreachableError({
      method: 'GET',
      url: 'https://api.example.com/resolve',
      failure: 'timeout',
      detail: 'The request timed out after retries (ECONNABORTED)',
    });
    fetchMock.mockRejectedValueOnce(unreachable);

    await expect(
      resolve_remote_dependency({ application_uid, version, build_context: 'local' })
    ).rejects.toBe(unreachable);
  });

  it('should throw ZephyrError when there is no response.value', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { value: null }));

    const promise = resolve_remote_dependency({
      application_uid,
      version,
      build_context: 'local',
    });

    await expect(promise).rejects.toThrow(ZephyrError);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('wraps an unclassified failure in a ZephyrError', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network Error'));

    await expect(
      resolve_remote_dependency({ application_uid, version, build_context: 'local' })
    ).rejects.toThrow(ZephyrError);
  });

  it('falls back to the latest published version when a workspace build is not found', async () => {
    // workspace:* has no matching build in the current context (e.g. host built alone)
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: 'Not found' }));
    // fallback to "*" resolves against the latest published version
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { value: mock_api_response }));

    const result = await resolve_remote_dependency({
      application_uid,
      version: 'workspace:*',
      build_context: 'local',
    });

    expect(result).toEqual({ ...mock_api_response, version: '*' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(1).pathname).toContain(
      `/resolve/${encodeURIComponent(application_uid)}/${encodeURIComponent('*')}`
    );
  });

  it('throws when both the workspace resolution and the fallback fail', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'Not found' }));

    await expect(
      resolve_remote_dependency({
        application_uid,
        version: 'workspace:*',
        build_context: 'local',
      })
    ).rejects.toThrow(ZephyrError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not repeat the lookup for the fallback version when Zephyr is unreachable', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { message: 'Unavailable' }));

    const error = await resolve_remote_dependency({
      application_uid,
      version: 'workspace:*',
      build_context: 'local',
    }).catch((caught: unknown) => caught);

    expect(getZephyrErrorCategory(error)).toBe('unreachable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
