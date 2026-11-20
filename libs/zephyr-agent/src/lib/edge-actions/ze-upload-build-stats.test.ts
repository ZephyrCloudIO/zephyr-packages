import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';

const mocks = rs.hoisted(() => ({
  getToken: rs.fn(),
  makeRequest: rs.fn(),
}));

rs.mock('../node-persist/token', () => ({ getToken: mocks.getToken }));
rs.mock('../http/http-request', () => ({ makeRequest: mocks.makeRequest }));
rs.mock('../logging', () => ({ ze_log: { upload: rs.fn() } }));

import { ZeErrors, ZephyrError } from '../errors';
import { zeUploadBuildStats } from './ze-upload-build-stats';

function buildStats(buildId: string): ZephyrBuildStats {
  return {
    id: 'app.project.org',
    app: { buildId, name: 'checkout-web' },
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

describe('zeUploadBuildStats upload outcome', () => {
  const deniedEntry = {
    environment: { id: 'env-prod', name: 'production', type: 'production' },
    profile: { id: 'profile-1', name: 'web / production' },
    requiredRole: 'member',
    reason: 'no_grant',
    contacts: [{ id: 'user-1', name: 'Ada Admin' }],
    moreContacts: 0,
  };

  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getToken.mockResolvedValue('private-access-token');
  });

  it('fails with ZE10038 when the deploy was denied', async () => {
    mocks.makeRequest.mockResolvedValue([
      true,
      null,
      {
        status: 'ok',
        outcome: {
          result: 'denied',
          version: { id: 'version-1', snapshotId: 'snapshot-1' },
          denied: [deniedEntry],
        },
        ignoredEnvs: [{ id: 'env-prod', name: 'production', reason: 'denied' }],
      },
    ]);

    const upload = zeUploadBuildStats(buildStats('build-1'));

    await expect(upload).rejects.toMatchObject({ code: 'ZE10038' });
    await expect(upload).rejects.toThrow(
      'Deploy denied for checkout-web (version kept, nothing moved)'
    );
  });

  it('returns the targets when the deploy went through', async () => {
    mocks.makeRequest.mockResolvedValue([
      true,
      null,
      {
        status: 'ok',
        targets: ['https://tag.edge.test'],
        outcome: {
          result: 'deployed',
          version: { id: 'version-1', snapshotId: 'snapshot-1' },
          denied: [],
        },
      },
    ]);

    await expect(zeUploadBuildStats(buildStats('build-1'))).resolves.toEqual([
      'https://tag.edge.test',
    ]);
  });

  it('behaves as before without an outcome (flag off or older gateway)', async () => {
    mocks.makeRequest.mockResolvedValue([true, null, { status: 'ok' }]);

    await expect(zeUploadBuildStats(buildStats('build-1'))).resolves.toEqual([]);
  });

  it('passes a deploy denial from the HTTP layer through unchanged', async () => {
    const denial = new ZephyrError(ZeErrors.ERR_DEPLOY_DENIED, { message: 'denied' });
    mocks.makeRequest.mockResolvedValue([false, denial]);

    await expect(zeUploadBuildStats(buildStats('build-1'))).rejects.toBe(denial);
  });

  it('still wraps other failures as a failed upload', async () => {
    mocks.makeRequest.mockResolvedValue([false, new Error('boom')]);

    await expect(zeUploadBuildStats(buildStats('build-1'))).rejects.toMatchObject({
      code: 'ZE20017',
    });
  });
});
