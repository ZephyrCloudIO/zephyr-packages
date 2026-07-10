import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';

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
