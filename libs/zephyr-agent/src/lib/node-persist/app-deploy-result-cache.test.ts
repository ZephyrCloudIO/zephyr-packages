import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  keys: rs.fn(),
}));

rs.mock('./storage', () => ({
  storage: Promise.resolve(),
  keys: mocks.keys,
}));

import { getAllDeployedApps } from './app-deploy-result-cache';
import { StorageKeys } from './storage-keys';

describe('getAllDeployedApps', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('returns an empty list when persistence has no initialized key index', async () => {
    mocks.keys.mockResolvedValue(undefined);

    await expect(getAllDeployedApps()).resolves.toEqual([]);
  });

  it('ignores malformed persistence keys and requires a delimited application id', async () => {
    const prefix = `${StorageKeys.ze_app_deploy_result}:`;
    mocks.keys.mockResolvedValue([
      undefined,
      null,
      7,
      {},
      StorageKeys.ze_app_deploy_result,
      prefix,
      `${StorageKeys.ze_app_deploy_result}-lookalike`,
      `${prefix}app-one`,
      `${prefix}app-two`,
    ]);

    await expect(getAllDeployedApps()).resolves.toEqual(['app-one', 'app-two']);
  });
});
