import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZeApplicationConfig } from '../../lib/node-persist/upload-provider-options';
import { resolveIsolatedIdentityName } from '../../lib/build-context/isolated-identity';
import { ZephyrEngine } from '../index';

const mocks = rs.hoisted(() => ({
  getBuildId: rs.fn(),
  getHashList: rs.fn(),
  createLogger: rs.fn(),
  logEvent: rs.fn(),
  getZephyrConfig: rs.fn(),
  getPackageJson: rs.fn(),
  getGitInfo: rs.fn(),
  getGitRepositoryName: rs.fn(),
  checkAuth: rs.fn(),
  getApplicationConfiguration: rs.fn(),
  maybeShowOutdatedPluginWarning: rs.fn(),
}));

rs.mock('../../lib/edge-requests/get-build-id', () => ({ getBuildId: mocks.getBuildId }));
rs.mock('../../lib/edge-hash-list/distributed-hash-control', () => ({
  get_hash_list: mocks.getHashList,
}));
rs.mock('../../lib/logging', () => ({
  ze_log: { init: rs.fn(), app: rs.fn(), upload: rs.fn() },
}));
rs.mock('../../lib/logging/ze-log-event', () => ({
  logger: mocks.createLogger,
  logFn: rs.fn(),
}));
rs.mock('../../lib/build-context/zephyr-config', () => ({
  getZephyrConfig: mocks.getZephyrConfig,
  mergeRemoteDependencies: rs.fn(),
}));
rs.mock('../../lib/build-context/ze-util-read-package-json', () => ({
  getPackageJson: mocks.getPackageJson,
}));
rs.mock('../../lib/build-context/ze-util-get-git-info', () => ({
  getGitInfo: mocks.getGitInfo,
  getGitRepositoryName: mocks.getGitRepositoryName,
}));
rs.mock('../../lib/auth/login', () => ({ checkAuth: mocks.checkAuth }));
rs.mock('../../lib/edge-requests/get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));
rs.mock('../../lib/version/outdated-plugin-warning', () => ({
  maybeShowOutdatedPluginWarning: mocks.maybeShowOutdatedPluginWarning,
}));

function appConfig(): ZeApplicationConfig {
  return {
    application_uid: 'skills-basic.repo.org',
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

function gitInfo(project: string) {
  return {
    app: { org: 'org', project },
    git: { name: 'Dev', email: 'dev@example.com', branch: 'main', commit: 'abc' },
  };
}

describe('ZephyrEngine isolated identity', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getHashList.mockResolvedValue({ hash_set: new Set<string>() });
    mocks.createLogger.mockReturnValue(mocks.logEvent);
    mocks.checkAuth.mockResolvedValue(undefined);
    mocks.getBuildId.mockResolvedValue('build-1');
    mocks.getApplicationConfiguration.mockResolvedValue(appConfig());
    mocks.getZephyrConfig.mockReturnValue({});
  });

  it('derives the name from the git project without reading any package.json', async () => {
    mocks.getGitInfo.mockResolvedValue(gitInfo('Skills_Basic'));

    const engine = await ZephyrEngine.create({
      builder: 'unknown',
      context: '/work/skills-basic',
      identity: { fromGitProject: true, isolated: true },
    });

    expect(mocks.getPackageJson).not.toHaveBeenCalled();
    expect(mocks.maybeShowOutdatedPluginWarning).not.toHaveBeenCalled();
    expect(mocks.getZephyrConfig).toHaveBeenCalledWith('/work/skills-basic', {
      isolated: true,
    });
    expect(mocks.getGitInfo).toHaveBeenCalledWith(
      '/work/skills-basic',
      {},
      { isolated: true }
    );
    expect(engine.applicationProperties).toEqual({
      org: 'org',
      project: 'Skills_Basic',
      name: 'skills-basic',
      version: '0.0.0',
    });
    expect(engine.application_uid).toBe('skills-basic.skills-basic.org');
    expect(engine.npmProperties).toEqual({ name: 'skills-basic', version: '0.0.0' });
  });

  it('names the provider from the repository even when zephyr.config sets project', async () => {
    // getGitInfo applies the config project override to app.project.
    mocks.getGitInfo.mockResolvedValue(gitInfo('Platform'));
    mocks.getZephyrConfig.mockReturnValue({ project: 'Platform' });
    mocks.getGitRepositoryName.mockResolvedValue('Skills_Basic');

    const engine = await ZephyrEngine.create({
      builder: 'unknown',
      context: '/work/skills-basic',
      identity: { fromGitProject: true, isolated: true },
    });

    expect(mocks.getGitRepositoryName).toHaveBeenCalledWith('/work/skills-basic');
    expect(engine.applicationProperties).toMatchObject({
      project: 'Platform',
      name: 'skills-basic',
    });
  });

  it('falls back to the directory name when a configured project hides no origin', async () => {
    mocks.getGitInfo.mockResolvedValue(gitInfo('Platform'));
    mocks.getZephyrConfig.mockReturnValue({ project: 'Platform' });
    mocks.getGitRepositoryName.mockResolvedValue(undefined);

    const engine = await ZephyrEngine.create({
      builder: 'unknown',
      context: '/work/Team Skills',
      identity: { fromGitProject: true, isolated: true },
    });

    expect(engine.applicationProperties.name).toBe('team-skills');
  });

  it('lets appName from the context config win and requires it to be a skill name', async () => {
    mocks.getGitInfo.mockResolvedValue(gitInfo('repo'));
    mocks.getZephyrConfig.mockReturnValue({ appName: 'billing-skills' });

    const engine = await ZephyrEngine.create({
      builder: 'unknown',
      context: '/work/repo',
      identity: { name: 'ignored-name', isolated: true },
    });
    expect(engine.applicationProperties.name).toBe('billing-skills');

    mocks.getZephyrConfig.mockReturnValue({ appName: 'Billing Skills' });
    await expect(
      ZephyrEngine.create({
        builder: 'unknown',
        context: '/work/repo',
        identity: { fromGitProject: true, isolated: true },
      })
    ).rejects.toThrow('appName must match');
  });

  it('keeps the package.json identity when no identity option is given', async () => {
    mocks.getGitInfo.mockResolvedValue(gitInfo('repo'));
    mocks.getPackageJson.mockResolvedValue({ name: 'web-app', version: '2.0.0' });

    const engine = await ZephyrEngine.create({
      builder: 'unknown',
      context: '/work/app',
    });

    expect(mocks.getZephyrConfig).toHaveBeenCalledWith('/work/app', { isolated: false });
    expect(mocks.getPackageJson).toHaveBeenCalledTimes(1);
    expect(engine.applicationProperties.name).toBe('web-app');
    expect(engine.applicationProperties.version).toBe('2.0.0');
  });
});

describe('resolveIsolatedIdentityName', () => {
  it('falls back from the git project to the directory basename', () => {
    expect(
      resolveIsolatedIdentityName({
        identity: { fromGitProject: true, isolated: true },
        gitProject: '@@@',
        context: '/tmp/skills-basic',
      })
    ).toBe('skills-basic');
    expect(
      resolveIsolatedIdentityName({
        identity: { fromGitProject: true, isolated: true },
        context: '/tmp/My.Skills',
      })
    ).toBe('my-skills');
  });

  it('rejects an explicit name that is not a skill name and an empty slug', () => {
    expect(() =>
      resolveIsolatedIdentityName({
        identity: { name: 'Not Valid', isolated: true },
        context: '/tmp/x',
      })
    ).toThrow('must match');
    expect(() =>
      resolveIsolatedIdentityName({
        identity: { fromGitProject: true, isolated: true },
        context: '/tmp/@@@',
      })
    ).toThrow('Could not derive');
  });
});
