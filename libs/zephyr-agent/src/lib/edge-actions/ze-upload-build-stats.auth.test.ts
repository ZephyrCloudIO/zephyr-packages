import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';

// Real transport (makeRequest), fake network: proves the 401 path end to end.
const mocks = rs.hoisted(() => ({
  fetchWithRetries: rs.fn(),
  getToken: rs.fn(),
  cleanTokens: rs.fn(),
}));

rs.mock('../http/fetch-with-retries', () => ({
  fetchWithRetries: mocks.fetchWithRetries,
}));
rs.mock('../node-persist/token', () => ({
  getToken: mocks.getToken,
  cleanTokens: mocks.cleanTokens,
}));
rs.mock('../logging', () => ({ ze_log: { upload: rs.fn(), error: rs.fn() } }));

import { zeUploadBuildStats } from './ze-upload-build-stats';

function buildStats(mcp: boolean): ZephyrBuildStats {
  return {
    id: 'app.project.org',
    app: { buildId: 'build-1' },
    ...(mcp ? { mcp: { manifestVersion: 1 } } : {}),
  } as unknown as ZephyrBuildStats;
}

describe('zeUploadBuildStats with a rejected credential (contract amendment 11.7)', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getToken.mockResolvedValue('rejected-token');
    mocks.fetchWithRetries.mockResolvedValue({
      status: 401,
      ok: false,
      text: async () => 'Unauthorized',
    } as Response);
  });

  it('keeps a 401 on an MCP version an authentication error and clears the credential', async () => {
    let error: unknown;
    try {
      await zeUploadBuildStats(buildStats(true));
    } catch (caught) {
      error = caught;
    }

    expect(ZephyrError.is(error, ZeErrors.ERR_AUTH_ERROR)).toBe(true);
    expect(ZephyrError.is(error, ZeErrors.ERR_FAILED_UPLOAD)).toBe(false);
    expect(mocks.fetchWithRetries).toHaveBeenCalledTimes(1);
    expect(mocks.cleanTokens).toHaveBeenCalledWith('rejected-token');
  });

  it('leaves the non-MCP build-stats failure unchanged', async () => {
    let error: unknown;
    try {
      await zeUploadBuildStats(buildStats(false));
    } catch (caught) {
      error = caught;
    }

    expect(ZephyrError.is(error, ZeErrors.ERR_FAILED_UPLOAD)).toBe(true);
    expect(mocks.cleanTokens).toHaveBeenCalledWith('rejected-token');
  });
});
