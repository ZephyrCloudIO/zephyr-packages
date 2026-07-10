import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZeApplicationConfig } from '../../lib/node-persist/upload-provider-options';
import { ApplicationContext, ZephyrEngine } from '../index';

const mocks = rs.hoisted(() => ({
  getBuildId: rs.fn(),
  getHashList: rs.fn(),
  createLogger: rs.fn(),
  logEvent: rs.fn(),
  getZephyrConfig: rs.fn(),
  mergeRemoteDependencies: rs.fn(),
  getPackageJson: rs.fn(),
  getGitInfo: rs.fn(),
  checkAuth: rs.fn(),
  getApplicationConfiguration: rs.fn(),
  maybeShowOutdatedPluginWarning: rs.fn(),
}));

rs.mock('../../lib/edge-requests/get-build-id', () => ({
  getBuildId: mocks.getBuildId,
}));
rs.mock('../../lib/edge-hash-list/distributed-hash-control', () => ({
  get_hash_list: mocks.getHashList,
}));
rs.mock('../../lib/logging', () => ({
  ze_log: {
    init: rs.fn(),
    app: rs.fn(),
    upload: rs.fn(),
  },
}));
rs.mock('../../lib/logging/ze-log-event', () => ({
  logger: mocks.createLogger,
  logFn: rs.fn(),
}));
rs.mock('../../lib/build-context/zephyr-config', () => ({
  getZephyrConfig: mocks.getZephyrConfig,
  mergeRemoteDependencies: mocks.mergeRemoteDependencies,
}));
rs.mock('../../lib/build-context/ze-util-read-package-json', () => ({
  getPackageJson: mocks.getPackageJson,
}));
rs.mock('../../lib/build-context/ze-util-get-git-info', () => ({
  getGitInfo: mocks.getGitInfo,
}));
rs.mock('../../lib/auth/login', () => ({ checkAuth: mocks.checkAuth }));
rs.mock('../../lib/edge-requests/get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));
rs.mock('../../lib/version/outdated-plugin-warning', () => ({
  maybeShowOutdatedPluginWarning: mocks.maybeShowOutdatedPluginWarning,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function appConfig(): ZeApplicationConfig {
  return {
    application_uid: 'app.project.org',
    BUILD_ID_ENDPOINT: '/build-id',
    EDGE_URL: 'https://edge.example',
    DELIMITER: '-',
    PLATFORM: 'cloudflare' as never,
    email: 'developer@example.com',
    jwt: 'jwt',
    user_uuid: 'user-id',
    username: 'developer',
  };
}

function engine(): ZephyrEngine {
  const value = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
  value.application_uid = 'app.project.org';
  value.applicationProperties = {
    name: 'app',
    project: 'project',
    org: 'org',
    version: '1.0.0',
  };
  value.application_configuration = Promise.resolve(appConfig());
  value.gitProperties = { git: {} } as never;
  value.env = { isCI: false, target: 'web', ssr: false };
  value.builder = 'vite';
  value.federated_dependencies = null;
  return value;
}

describe('ZephyrEngine build lifecycle', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getHashList.mockResolvedValue({ hash_set: new Set<string>() });
    mocks.createLogger.mockReturnValue(mocks.logEvent);
    mocks.checkAuth.mockResolvedValue(undefined);
    mocks.maybeShowOutdatedPluginWarning.mockResolvedValue(undefined);
  });

  it('loads one immutable config and uses it for package, git, and app identity', async () => {
    const config = Object.freeze({
      org: 'configured-org',
      project: 'configured-project',
      appName: 'configured-app',
    });
    mocks.getZephyrConfig.mockReturnValue(config);
    mocks.getPackageJson.mockResolvedValue({ name: 'package-app', version: '1.0.0' });
    mocks.getGitInfo.mockResolvedValue({
      app: { org: config.org, project: config.project },
      git: { name: 'Developer', email: 'developer@example.com', branch: 'main' },
    });
    mocks.getApplicationConfiguration.mockResolvedValue(appConfig());
    mocks.getBuildId.mockResolvedValue('configured-build-id');

    const value = await ZephyrEngine.create({
      builder: 'vite',
      context: '/workspace/configured-app',
    });

    expect(mocks.getZephyrConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getPackageJson).toHaveBeenCalledWith(
      '/workspace/configured-app',
      config
    );
    expect(mocks.getGitInfo).toHaveBeenCalledWith('/workspace/configured-app', config);
    expect(value.applicationProperties).toEqual({
      org: 'configured-org',
      project: 'configured-project',
      name: 'configured-app',
      version: '1.0.0',
    });
    expect(value.application_uid).toBe(
      'configured-app.configured-project.configured-org'
    );
    value.build_failed();
  });

  it('reports active ownership until the generation is rolled back', () => {
    const value = engine();
    value.build_start_time = null;
    value.build_id = null;
    value.snapshotId = null;
    expect(value.hasActiveBuild).toBe(false);

    value.build_start_time = Date.now();
    expect(value.hasActiveBuild).toBe(true);
    value.build_failed();
    expect(value.hasActiveBuild).toBe(false);
  });

  it('handles an early deferred-create rejection until a later hook awaits it', async () => {
    const createFailure = new Error('engine initialization failed');
    const create = rs.spyOn(ZephyrEngine, 'create').mockRejectedValueOnce(createFailure);
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
      zephyr_defer_create({ builder: 'vite', context: '/project' });

      // Model the gap between an early config hook and a later output hook.
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
      await expect(zephyr_engine_defer).rejects.toBe(createFailure);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      create.mockRestore();
    }
  });

  it('creates only one engine across repeated reusable-plugin initialization hooks', async () => {
    const createdEngine = engine();
    const create = rs.spyOn(ZephyrEngine, 'create').mockResolvedValueOnce(createdEngine);

    try {
      const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
      const options = { builder: 'rollup' as const, context: '/project' };
      zephyr_defer_create(options);
      zephyr_defer_create(options);

      await expect(zephyr_engine_defer).resolves.toBe(createdEngine);
      expect(create).toHaveBeenCalledTimes(1);
    } finally {
      create.mockRestore();
    }
  });

  it('rejects logger initialization instead of leaving awaiters pending', async () => {
    const value = engine();
    const buildIdFailure = new Error('build ID unavailable');
    mocks.getBuildId
      .mockRejectedValueOnce(buildIdFailure)
      .mockResolvedValueOnce('retry-build-id');

    const firstStart = value.start_new_build();
    const failedLogger = value.logger;

    await expect(firstStart).rejects.toBe(buildIdFailure);
    await expect(failedLogger).rejects.toBe(buildIdFailure);
    expect(value.build_id).toBeNull();
    expect(value.snapshotId).toBeNull();
    expect(value.hash_list).toBeNull();

    await expect(value.start_new_build()).resolves.toBeUndefined();
    await expect(value.build_id).resolves.toBe('retry-build-id');
    await expect(value.logger).resolves.toBe(mocks.logEvent);
    expect(mocks.createLogger).toHaveBeenLastCalledWith(
      expect.objectContaining({ buildId: 'retry-build-id' })
    );
  });

  it('prevents a late hash-list result from contaminating a replacement build', async () => {
    const value = engine();
    const staleHashList = deferred<{ hash_set: Set<string> }>();
    const currentHashList = { hash_set: new Set(['current']) };
    mocks.getBuildId
      .mockResolvedValueOnce('failed-build-id')
      .mockResolvedValueOnce('current-build-id');
    mocks.getHashList
      .mockReturnValueOnce(staleHashList.promise)
      .mockResolvedValueOnce(currentHashList);

    await value.start_new_build();
    value.build_failed();
    await value.start_new_build();
    staleHashList.resolve({ hash_set: new Set(['stale']) });
    await staleHashList.promise;
    await Promise.resolve();

    expect(value.resolved_hash_list).toBe(currentHashList);
    await expect(value.build_id).resolves.toBe('current-build-id');
  });

  it('rolls back a failed publication and retries with a fresh one-flight build', async () => {
    const value = engine();
    const failedHashes = { hash_set: new Set(['failed-hash']) };
    const retryHashes = { hash_set: new Set(['retry-hash']) };
    mocks.getBuildId
      .mockResolvedValueOnce('failed-build-id')
      .mockResolvedValueOnce('retry-build-id');
    mocks.getHashList
      .mockResolvedValueOnce(failedHashes)
      .mockResolvedValueOnce(retryHashes);
    await value.start_new_build();

    const publishFailure = new Error('production upload failed');
    const publishedBuildIds: string[] = [];
    const publishedSnapshotIds: string[] = [];
    const publish = rs.fn(async () => {
      const buildId = await value.build_id;
      const snapshotId = await value.snapshotId;
      publishedBuildIds.push(buildId as string);
      publishedSnapshotIds.push(snapshotId as string);
      if (publishedBuildIds.length === 1) {
        throw publishFailure;
      }
      return buildId as string;
    });
    const context = new ApplicationContext({
      applicationUid: value.application_uid,
      prepare: ({ generation }) =>
        generation === 0 ? undefined : value.start_new_build(),
      publish,
      finish: () => value.build_finished(),
      onFailure: () => value.build_failed(),
    });

    const failed = context.beginBuild({
      invocationId: 'watch',
      generation: 0,
      participants: [{ name: 'client' }],
    });
    failed.completeParticipant('client');
    const failedPublish = failed.publish();
    expect(failed.publish()).toBe(failedPublish);
    await expect(failedPublish).rejects.toBe(publishFailure);

    expect(value.build_id).toBeNull();
    expect(value.snapshotId).toBeNull();
    expect(value.hash_list).toBeNull();
    expect(value.resolved_hash_list).toBeNull();
    expect(value.snapshot_with_envs).toBeNull();
    expect(value.ze_env_vars).toBeNull();

    const retry = context.beginBuild({
      invocationId: 'watch',
      generation: 1,
      participants: [{ name: 'client' }],
    });
    retry.completeParticipant('client');
    const firstRetry = retry.publish();
    const secondRetry = retry.publish();
    expect(secondRetry).toBe(firstRetry);
    await expect(Promise.all([firstRetry, secondRetry])).resolves.toEqual([
      'retry-build-id',
      'retry-build-id',
    ]);

    expect(publish).toHaveBeenCalledTimes(2);
    expect(publishedBuildIds).toEqual(['failed-build-id', 'retry-build-id']);
    expect(publishedSnapshotIds[1]).toContain('retry-build-id');
    expect(mocks.createLogger).toHaveBeenCalledTimes(2);
    expect(value.build_id).toBeNull();
  });
});
