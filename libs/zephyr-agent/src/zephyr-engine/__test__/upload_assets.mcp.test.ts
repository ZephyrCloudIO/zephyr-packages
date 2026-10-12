import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ZEPHYR_MANIFEST_FILENAME,
  type ZeBuildAssetsMap,
  type ZephyrBuildStats,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../../lib/errors';
import type { ZeApplicationConfig } from '../../lib/node-persist/upload-provider-options';
import { UploadProviderType } from '../../lib/node-persist/upload-provider-options';
import { readFixtureTree } from '../../lib/mcp/__fixtures__/read-fixture-tree';
import { zeBuildAssets } from '../../lib/transformers/ze-build-assets';
import { ZephyrEngine, type UploadOptions } from '../index';

const mocks = rs.hoisted(() => ({
  getUploadStrategy: rs.fn(),
  uploadStrategy: rs.fn(),
  setAppDeployResult: rs.fn(),
  logFn: rs.fn(),
  logEvent: rs.fn(),
}));

rs.mock('../../lib/deployment/get-upload-strategy', () => ({
  getUploadStrategy: mocks.getUploadStrategy,
}));
rs.mock('../../lib/node-persist/app-deploy-result-cache', () => ({
  setAppDeployResult: mocks.setAppDeployResult,
}));
rs.mock('../../lib/logging/ze-log-event', () => ({
  logFn: mocks.logFn,
  logger: rs.fn(),
}));

const artifactRoot = join(
  import.meta.dirname,
  '..',
  '..',
  'lib',
  'mcp',
  '__fixtures__',
  'contract',
  'artifacts',
  'tools-basic'
);

function artifactAssets(): ZeBuildAssetsMap {
  const assets: ZeBuildAssetsMap = {};
  for (const [filepath, content] of readFixtureTree(artifactRoot)) {
    const asset = zeBuildAssets({ filepath, content });
    assets[asset.hash] = asset;
  }
  return assets;
}

function appConfig(overrides: Partial<ZeApplicationConfig> = {}): ZeApplicationConfig {
  return {
    application_uid: 'tools-basic.project.org',
    BUILD_ID_ENDPOINT: '/build-id',
    EDGE_URL: 'https://edge.example.test',
    DELIMITER: '-',
    PLATFORM: UploadProviderType.CLOUDFLARE,
    email: 'developer@example.test',
    jwt: 'test-jwt',
    user_uuid: 'user-id',
    username: 'developer',
    MCP_PRIVATE_SNAPSHOTS: true,
    ...overrides,
  };
}

function readyEngine(config = appConfig()): ZephyrEngine {
  const engine = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
  engine.application_uid = 'tools-basic.project.org';
  engine.applicationProperties = {
    org: 'org',
    project: 'project',
    name: 'tools-basic',
    version: '1.0.0',
  };
  engine.application_configuration = Promise.resolve(config);
  engine.gitProperties = {
    git: { name: 'Dev', email: 'dev@example.test', branch: 'main', commit: 'abc' },
  } as never;
  engine.env = { isCI: false, target: 'web', ssr: false };
  engine.buildProperties = { output: './dist' };
  engine.builder = 'unknown';
  engine.federated_dependencies = null;
  engine.build_id = Promise.resolve('build-1');
  engine.snapshotId = Promise.resolve('snapshot-1');
  engine.resolved_hash_list = { hash_set: new Set<string>() };
  engine.sourceContext = '';
  engine.logger = Promise.resolve(mocks.logEvent as never);
  return engine;
}

const buildStats = {
  remote: 'remoteEntry.js',
  mf_manifest: 'mf-manifest.json',
} as unknown as ZephyrBuildStats;

function uploadedOptions(): UploadOptions {
  return mocks.uploadStrategy.mock.calls[0]?.[1] as UploadOptions;
}

describe('ZephyrEngine.upload_assets for an MCP provider', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    delete process.env['ZE_WAIT_FOR_DEPLOYMENTS'];
    mocks.uploadStrategy.mockResolvedValue('https://deploy.example.test/tools-basic');
    mocks.getUploadStrategy.mockReturnValue(mocks.uploadStrategy);
    mocks.setAppDeployResult.mockResolvedValue(undefined);
  });

  it('marks the snapshot and build stats and uploads exactly the artifact set', async () => {
    const engine = readyEngine();
    const assetsMap = artifactAssets();
    const evalResults = JSON.parse(
      readFileSync(join(artifactRoot, '..', '..', 'eval-results.json'), 'utf8')
    );

    await engine.upload_assets({ assetsMap, buildStats, mcpEvalResults: evalResults });

    const options = uploadedOptions();
    expect(options.snapshot.mcp).toEqual({
      manifestVersion: 1,
      name: 'tools-basic',
      descriptor: 'mcp-provider.json',
      catalog: 'catalog.json',
      catalogSha256: '446fbba346591f3570fff6937e35c2836b1682943801e11737f1df8c7f3ca209',
      entry: 'tools/index.js',
    });
    expect(Object.keys(options.snapshot.assets)).not.toContain(ZEPHYR_MANIFEST_FILENAME);
    expect(Object.keys(options.snapshot.assets)).toHaveLength(10);

    const dashData = options.getDashData(engine);
    expect(dashData.remote).toBe('');
    expect(dashData).not.toHaveProperty('mf_manifest');
    expect(dashData.waitForCompletion).toBe(true);
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'deploy:wait' })
    );
    expect(dashData.mcp).toMatchObject({
      manifestVersion: 1,
      catalogSha256: options.snapshot.mcp?.catalogSha256,
      evalResults,
    });
    expect(dashData.mcp?.catalog.provider).toEqual({
      name: 'tools-basic',
      version: '1.0.0',
    });
  });

  it('fails closed before any upload when the application is not eligible', async () => {
    const engine = readyEngine(appConfig({ MCP_PRIVATE_SNAPSHOTS: undefined }));

    const error = await engine
      .upload_assets({ assetsMap: artifactAssets(), buildStats })
      .catch((caught: unknown) => caught);

    expect(ZephyrError.is(error, ZeErrors.ERR_DEPLOY_LOCAL_BUILD)).toBe(true);
    expect(mocks.uploadStrategy).not.toHaveBeenCalled();
    // build_failed reset the generation
    expect(engine.build_id).toBeNull();
  });

  it('fails closed for a non-root baseHref', async () => {
    const engine = readyEngine();
    engine.buildProperties.baseHref = '/skills';

    await expect(
      engine.upload_assets({ assetsMap: artifactAssets(), buildStats })
    ).rejects.toThrow('baseHref');
    expect(mocks.uploadStrategy).not.toHaveBeenCalled();
  });

  it('rejects any extra asset in an MCP upload', async () => {
    const engine = readyEngine();
    const assetsMap = artifactAssets();
    const extra = zeBuildAssets({ filepath: 'index.html', content: '<html></html>' });
    assetsMap[extra.hash] = extra;

    await expect(engine.upload_assets({ assetsMap, buildStats })).rejects.toThrow(
      'ZD0741 index.html'
    );
    expect(mocks.uploadStrategy).not.toHaveBeenCalled();
  });

  it('keeps web uploads unchanged and rejects eval results without a descriptor', async () => {
    const engine = readyEngine(appConfig({ MCP_PRIVATE_SNAPSHOTS: undefined }));
    const page = zeBuildAssets({ filepath: 'index.html', content: '<html></html>' });

    await engine.upload_assets({ assetsMap: { [page.hash]: page }, buildStats });
    const options = uploadedOptions();
    expect(options.snapshot).not.toHaveProperty('mcp');
    expect(Object.keys(options.snapshot.assets)).toContain(ZEPHYR_MANIFEST_FILENAME);
    const dashData = options.getDashData(engine);
    expect(dashData.remote).toBe('remoteEntry.js');
    expect(dashData.waitForCompletion).toBe(false);
    expect(dashData).not.toHaveProperty('mcp');

    const retry = readyEngine();
    await expect(
      retry.upload_assets({
        assetsMap: { [page.hash]: page },
        buildStats,
        mcpEvalResults: { format: 'zephyr-evals/v1' } as never,
      })
    ).rejects.toThrow('no root mcp-provider.json');
  });

  it('warns about and ignores a nested descriptor', async () => {
    const engine = readyEngine();
    const nested = zeBuildAssets({ filepath: 'docs/mcp-provider.json', content: '{}' });

    await engine.upload_assets({ assetsMap: { [nested.hash]: nested }, buildStats });

    expect(uploadedOptions().snapshot).not.toHaveProperty('mcp');
    expect(mocks.logFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('docs/mcp-provider.json')
    );
  });
});
