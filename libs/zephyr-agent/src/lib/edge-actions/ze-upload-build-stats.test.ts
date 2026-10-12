import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';

const mocks = rs.hoisted(() => ({
  getToken: rs.fn(),
  makeRequest: rs.fn(),
}));

rs.mock('../node-persist/token', () => ({ getToken: mocks.getToken }));
rs.mock('../http/http-request', () => ({ makeRequest: mocks.makeRequest }));
rs.mock('../logging', () => ({ ze_log: { upload: rs.fn() } }));

import { zeUploadBuildStats } from './ze-upload-build-stats';

function buildStats(buildId: string): ZephyrBuildStats {
  return {
    id: 'app.project.org',
    app: { buildId },
  } as unknown as ZephyrBuildStats;
}

describe('zeUploadBuildStats retry identity', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getToken.mockResolvedValue('private-access-token');
    mocks.makeRequest.mockResolvedValue([true, null, { status: 'ok', targets: [] }]);
  });

  it('sends a stable, build-scoped idempotency key without exposing the token', async () => {
    await zeUploadBuildStats(buildStats('build-1'));
    await zeUploadBuildStats(buildStats('build-1'));
    await zeUploadBuildStats(buildStats('build-2'));

    const firstOptions = mocks.makeRequest.mock.calls[0][1] as RequestInit;
    const secondOptions = mocks.makeRequest.mock.calls[1][1] as RequestInit;
    const thirdOptions = mocks.makeRequest.mock.calls[2][1] as RequestInit;
    const firstHeaders = firstOptions.headers as Record<string, string>;
    const secondHeaders = secondOptions.headers as Record<string, string>;
    const thirdHeaders = thirdOptions.headers as Record<string, string>;

    expect(firstHeaders['Idempotency-Key']).toMatch(/^[a-f0-9]{64}$/);
    expect(firstHeaders['Idempotency-Key']).toBe(secondHeaders['Idempotency-Key']);
    expect(firstHeaders['Idempotency-Key']).not.toBe(thirdHeaders['Idempotency-Key']);
    expect(firstHeaders['Idempotency-Key']).not.toContain('private-access-token');
  });
});

describe('zeUploadBuildStats for an MCP provider version', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getToken.mockResolvedValue('private-access-token');
  });

  it('uses a 120 s deadline, no 4xx retries, and maps 4xx to a local build error', async () => {
    mocks.makeRequest.mockResolvedValue([true, null, { status: 'ok', targets: [] }]);

    await zeUploadBuildStats({ ...buildStats('build-1'), mcp: {} } as ZephyrBuildStats);

    const options = mocks.makeRequest.mock.calls[0][1] as Record<string, unknown>;
    expect(options['deadlineMs']).toBe(120_000);
    expect(options['retryClientErrors']).toBe(false);
    const mapError = options['mapErrorResponse'] as (
      status: number,
      body: unknown
    ) => Error | undefined;
    expect(mapError(422, { issues: [{ path: ['mcp', 'catalog'] }] })?.message).toContain(
      'mcp.catalog'
    );
    expect(mapError(503, {})).toBeUndefined();
  });

  it('rethrows the mapped local build error instead of a generic upload failure', async () => {
    const rejection = new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: 'rejected',
    });
    mocks.makeRequest.mockResolvedValue([false, rejection]);

    await expect(
      zeUploadBuildStats({ ...buildStats('build-1'), mcp: {} } as ZephyrBuildStats)
    ).rejects.toBe(rejection);
  });

  it('keeps the default transport for non-MCP build stats', async () => {
    mocks.makeRequest.mockResolvedValue([true, null, { status: 'ok', targets: [] }]);

    await zeUploadBuildStats(buildStats('build-1'));

    const options = mocks.makeRequest.mock.calls[0][1] as Record<string, unknown>;
    expect(options).not.toHaveProperty('deadlineMs');
    expect(options).not.toHaveProperty('mapErrorResponse');
  });
});
