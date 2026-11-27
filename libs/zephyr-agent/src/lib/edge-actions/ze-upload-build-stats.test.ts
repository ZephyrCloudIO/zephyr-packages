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
    edge: { url: 'https://edge.test', versionUrl: 'https://version.edge.test' },
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

describe('zeUploadBuildStats request body', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getToken.mockResolvedValue('private-access-token');
    mocks.makeRequest.mockResolvedValue([true, null, { status: 'ok', targets: [] }]);
  });

  it('asks the gateway for the upload outcome and keeps the build stats', async () => {
    await zeUploadBuildStats(buildStats('build-1'));

    const body = JSON.parse(mocks.makeRequest.mock.calls[0][2] as string);
    expect(body).toEqual({ ...buildStats('build-1'), reportOutcome: true });
  });
});

describe('zeUploadBuildStats upload outcome', () => {
  const envId = '0190a1b2-0000-7000-8000-000000000010';
  const versionId = '0190a1b2-0000-7000-8000-000000000002';
  // The upload outcome carries contact ids only (ZephyrCloudIO/zephyr-cloud-io#4501).
  const deniedEntry = {
    environment: { id: envId, name: 'production', type: 'production' },
    profile: { id: '0190a1b2-0000-7000-8000-000000000020', name: 'web / production' },
    requiredRole: 'member',
    reason: 'no_grant',
    contacts: [{ id: '0190a1b2-0000-7000-8000-000000000041' }],
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
          version: { id: versionId, snapshotId: 'snapshot-1' },
          denied: [deniedEntry],
        },
        ignoredEnvs: [{ id: envId, name: 'production', reason: 'denied' }],
      },
    ]);

    const upload = zeUploadBuildStats(buildStats('build-1'));

    await expect(upload).rejects.toMatchObject({
      code: 'ZE10038',
      data: {
        applicationUid: 'app.project.org',
        versionId,
        versionUrl: 'https://version.edge.test',
        deniedEnvironmentIds: [envId],
      },
    });
    await expect(upload).rejects.toThrow(
      'Deploy denied for checkout-web (version kept, nothing moved)\n' +
        '  version: https://version.edge.test\n' +
        '  production  profile "web / production"  needs the Member role'
    );
  });

  it('fails from result alone when the details and ignoredEnvs are missing', async () => {
    mocks.makeRequest.mockResolvedValue([
      true,
      null,
      {
        status: 'ok',
        outcome: { result: 'denied', version: { id: versionId }, denied: [null] },
        ignoredEnvs: null,
      },
    ]);

    await expect(zeUploadBuildStats(buildStats('build-1'))).rejects.toMatchObject({
      code: 'ZE10038',
    });
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
          version: { id: versionId, snapshotId: 'snapshot-1' },
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
