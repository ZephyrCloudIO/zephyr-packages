import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Snapshot } from 'zephyr-edge-contract';
import {
  UploadProviderType,
  type EnvironmentConfig,
  type ZeApplicationConfig,
} from '../node-persist/upload-provider-options';

const mocks = rs.hoisted(() => ({
  getApplicationConfiguration: rs.fn(),
  makeRequest: rs.fn(),
}));

rs.mock('../edge-requests/get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));

rs.mock('./http-request', () => ({
  makeRequest: mocks.makeRequest,
}));

rs.mock('../logging', () => ({
  ze_log: { snapshot: rs.fn() },
}));

import { createSnapshotUploadTargets, uploadSnapshot } from './upload-snapshot';

function snapshot(): Snapshot {
  return {
    application_uid: 'org.project.app',
    version: '1.0.0-user.1',
    snapshot_id: 'snapshot-1',
    domain: 'https://primary.example.test',
    uid: { build: '1', app_name: 'app', repo: 'project', org: 'org' },
    git: { branch: 'main', commit: 'abc' },
    creator: { name: 'Test', email: 'test@example.test' },
    createdAt: 1,
    assets: {
      'assets/app.js': {
        path: 'assets/app.js',
        extname: '.js',
        hash: 'asset-hash',
        size: 10,
      },
    },
  };
}

function environment(
  edgeUrl: string,
  addressMode: 'hostname' | 'path'
): EnvironmentConfig {
  return {
    type: UploadProviderType.CLOUDFLARE,
    edgeUrl,
    delimiter: '.',
    addressMode,
    remote_host: new URL(edgeUrl).hostname,
  };
}

function applicationConfig(
  overrides: Partial<ZeApplicationConfig> = {}
): ZeApplicationConfig {
  return {
    application_uid: 'org.project.app',
    BUILD_ID_ENDPOINT: '/build-id',
    EDGE_URL: 'https://primary.example.test',
    DELIMITER: '.',
    ADDRESS_MODE: 'hostname',
    PLATFORM: UploadProviderType.CLOUDFLARE,
    email: 'test@example.test',
    jwt: 'jwt',
    user_uuid: 'user-1',
    username: 'Test',
    ...overrides,
  };
}

describe('snapshot upload targets', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('clones domain and address mode per mixed hostname/path target', () => {
    const original = snapshot();
    const targets = createSnapshotUploadTargets(
      original,
      applicationConfig({
        ENVIRONMENTS: {
          path: environment('https://path.example.test', 'path'),
          hostname: environment('https://host.example.test', 'hostname'),
        },
      })
    );

    expect(targets.map(({ edgeUrl }) => edgeUrl)).toEqual([
      'https://primary.example.test',
      'https://host.example.test',
      'https://path.example.test',
    ]);
    expect(targets[0]?.snapshot).toMatchObject({
      domain: 'https://primary.example.test',
      snapshot_id: original.snapshot_id,
      assets: original.assets,
    });
    expect(targets[0]?.snapshot.addressMode).toBeUndefined();
    expect(targets[1]?.snapshot.addressMode).toBeUndefined();
    expect(targets[2]?.snapshot).toMatchObject({
      domain: 'https://path.example.test',
      addressMode: 'path',
      snapshot_id: original.snapshot_id,
      assets: original.assets,
    });
  });

  it('deduplicates equivalent edge URLs in deterministic environment-name order', () => {
    const targets = createSnapshotUploadTargets(
      snapshot(),
      applicationConfig({
        ENVIRONMENTS: {
          zebra: environment('https://duplicate.example.test/', 'path'),
          alpha: environment('https://duplicate.example.test', 'path'),
        },
      })
    );

    expect(targets).toHaveLength(2);
    expect(targets[1]).toMatchObject({
      edgeUrl: 'https://duplicate.example.test',
      snapshot: { addressMode: 'path' },
    });
  });

  it('rejects conflicting address modes for the same edge URL', () => {
    expect(() =>
      createSnapshotUploadTargets(
        snapshot(),
        applicationConfig({
          ENVIRONMENTS: {
            path: environment('https://primary.example.test/', 'path'),
          },
        })
      )
    ).toThrow('Could not upload snapshot');
  });

  it('uploads target-specific snapshot JSON while preserving primary response', async () => {
    mocks.getApplicationConfiguration.mockResolvedValue(
      applicationConfig({
        ENVIRONMENTS: {
          path: environment('https://path.example.test', 'path'),
        },
      })
    );
    const primaryResponse = { urls: { version: 'https://primary/version' } };
    mocks.makeRequest
      .mockResolvedValueOnce([true, null, primaryResponse])
      .mockResolvedValueOnce([true, null, { urls: { version: 'https://path/version' } }]);

    await expect(
      uploadSnapshot({ body: snapshot(), application_uid: 'org.project.app' })
    ).resolves.toBe(primaryResponse);

    expect(mocks.makeRequest).toHaveBeenCalledTimes(2);
    const primaryBody = JSON.parse(mocks.makeRequest.mock.calls[0]?.[2] as string);
    const pathBody = JSON.parse(mocks.makeRequest.mock.calls[1]?.[2] as string);
    expect(primaryBody).toMatchObject({
      domain: 'https://primary.example.test',
      snapshot_id: 'snapshot-1',
    });
    expect(primaryBody.addressMode).toBeUndefined();
    expect(pathBody).toMatchObject({
      domain: 'https://path.example.test',
      addressMode: 'path',
      snapshot_id: 'snapshot-1',
    });
    expect(pathBody.assets).toEqual(primaryBody.assets);
  });
});
