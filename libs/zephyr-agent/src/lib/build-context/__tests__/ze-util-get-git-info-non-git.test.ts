import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import { execFile as node_execFile } from 'node:child_process';
import { getGitInfo } from '../ze-util-get-git-info';

rs.mock('node:child_process', () => ({
  execFile: rs.fn(),
}));

rs.mock('../../node-persist/secret-token', () => ({
  hasSecretToken: rs.fn().mockReturnValue(false),
}));

rs.mock('../../logging', () => ({
  ze_log: {
    git: rs.fn(),
  },
}));

rs.mock('../../logging/ze-log-event', () => ({
  logFn: rs.fn(),
}));

rs.mock('is-ci', () => ({ default: false }));

rs.mock('../ze-util-read-package-json', () => ({
  getPackageJson: rs.fn(),
}));

rs.mock('../../node-persist/token', () => ({
  getToken: rs.fn(),
}));

rs.mock('../../http/http-request', () => ({
  makeRequest: rs.fn(),
}));

rs.mock('../../auth/login', () => ({
  isTokenStillValid: rs.fn(),
}));

rs.mock('../detect-monorepo', () => ({
  detectMonorepo: rs.fn().mockResolvedValue({ type: 'none', root: process.cwd() }),
  getMonorepoRootPackageJson: rs.fn().mockResolvedValue(null),
}));

type GitOutputs = Record<string, string>;

describe('getGitInfo - non-git environments', () => {
  const mockExecFile = node_execFile as unknown as Mock;
  type ExecCallback = (error: Error | null, stdout?: unknown, stderr?: string) => void;

  /**
   * ExecFile is called as execFile('git', args, options, callback). Tests reply
   * per-command using the git args, matching the per-command implementation.
   */
  const mockGit = (
    resolve: (args: string[]) => { stdout?: string; error?: Error } | undefined
  ) => {
    mockExecFile.mockImplementation(
      (_file: string, args: string[], _options: unknown, callback?: ExecCallback) => {
        const cb = (typeof _options === 'function' ? _options : callback) as ExecCallback;
        if (!cb) throw new Error('expected child_process.execFile callback');
        const result = resolve(args) ?? { error: new Error('command failed') };
        if (result.error) {
          cb(result.error, '', 'fatal: command failed');
        } else {
          cb(null, { stdout: result.stdout ?? '', stderr: '' });
        }
        return undefined;
      }
    );
  };

  /** Every git command fails => no local repository at all. */
  const noGitRepo = () => mockGit(() => ({ error: new Error('Not a git repository') }));

  /** Local repo unavailable, but global config resolves. */
  const globalGitOnly = (outputs: GitOutputs) =>
    mockGit((args) => {
      const key = args.join(' ');
      if (key in outputs) return { stdout: outputs[key] };
      return { error: new Error('Not a git repository') };
    });

  const gitAvailable = (outputs: GitOutputs) =>
    mockGit((args) => {
      const key = args.join(' ');
      if (key in outputs) return { stdout: outputs[key] };
      return { stdout: '' };
    });

  let mockGitLog: Mock;
  let mockLogFn: Mock;
  let mockGetPackageJson: Mock;

  beforeEach(() => {
    rs.clearAllMocks();

    // Set NODE_ENV to production for tests expecting 'main' branch
    process.env.NODE_ENV = 'production';

    // Get the mocked ze_log.git function
    const { ze_log } = require('../../logging');
    mockGitLog = ze_log.git;
    mockGitLog.mockClear();

    // Get the mocked logFn function
    const { logFn } = require('../../logging/ze-log-event');
    mockLogFn = logFn;
    mockLogFn.mockClear();

    // Reset package.json mock
    const { getPackageJson } = require('../ze-util-read-package-json');
    mockGetPackageJson = getPackageJson;
    mockGetPackageJson.mockResolvedValue({
      name: 'test-project',
      version: '1.0.0',
    });

    // Mock authentication and API calls for fallback scenarios
    const { getToken } = require('../../node-persist/token');
    const { isTokenStillValid } = require('../../auth/login');
    const { makeRequest } = require('../../http/http-request');

    // Default token setup
    getToken.mockResolvedValue('valid-token');
    isTokenStillValid.mockReturnValue(true);
    makeRequest.mockResolvedValue([
      true,
      null,
      {
        value: {
          name: 'API User',
          email: 'api@example.com',
          id: 'user-123',
        },
      },
    ]);
  });

  it('should fall back to global git config when local repo not available', async () => {
    globalGitOnly({
      'config --global user.name': 'Global User',
      'config --global user.email': 'global@example.com',
    });

    const result = await getGitInfo();

    expect(result.git.name).toBe('Global User');
    expect(result.git.email).toBe('global@example.com');
    expect(result.git.branch).toMatch(/^global-git-\d{17}$/);
    expect(result.git.commit).toBe('no-git-commit');
    expect(result.app.org).toBe('global-user'); // org should be sanitized username for personal zephyr org
    expect(result.app.project).toBe('test-project'); // from package.json
  });

  it('threads an explicit context through fallback package and monorepo reads', async () => {
    const context = '/workspace/apps/context-app';
    const config = {};
    globalGitOnly({
      'config --global user.name': 'Global User',
      'config --global user.email': 'global@example.com',
    });

    await getGitInfo(context, config);

    const { detectMonorepo } = require('../detect-monorepo');
    expect(mockGetPackageJson).toHaveBeenCalledWith(context, config);
    expect(detectMonorepo).toHaveBeenCalledWith(context);
  });

  it('should fall back to API user info when neither local nor global git available', async () => {
    noGitRepo();

    const result = await getGitInfo();

    expect(result.git.name).toBe('API User');
    expect(result.git.email).toBe('api@example.com');
    expect(result.git.branch).toMatch(/^no-git-user-123-\d{17}$/);
    expect(result.git.commit).toMatch(/^fallback-deployment-\d+$/);
    expect(result.app.org).toBe('api-user'); // org should be sanitized API username
    expect(result.app.project).toBe('test-project'); // from package.json
  });

  it('should still work normally when git is available', async () => {
    gitAvailable({
      'config user.name': 'John Doe',
      'config user.email': 'john@example.com',
      'config --get remote.origin.url': 'https://github.com/example/repo.git',
      'symbolic-ref --short HEAD': 'main',
      'rev-parse HEAD': 'abc123def456',
      'tag --points-at HEAD': 'v1.0.0',
    });

    const result = await getGitInfo();

    expect(result.git.name).toBe('John Doe');
    expect(result.git.email).toBe('john@example.com');
    expect(result.git.branch).toBe('main');
    expect(result.git.commit).toBe('abc123def456');
    expect(result.git.tags).toEqual(['v1.0.0']);
    expect(result.app.org).toBe('example');
    expect(result.app.project).toBe('repo');
    // Should not log warnings when git is available
    expect(mockLogFn).not.toHaveBeenCalledWith('warn', expect.any(String));
  });

  it('uses configured identity without origin and runs every local git read in context', async () => {
    const context = '/workspace/apps/configured-app';
    gitAvailable({
      'config user.name': 'John Doe',
      'config user.email': 'john@example.com',
      'symbolic-ref --short HEAD': 'main',
      'rev-parse HEAD': 'abc123def456',
      // no origin, no tags
    });

    const result = await getGitInfo(context, {
      org: 'configured-org',
      project: 'configured-project',
    });

    expect(result.app).toEqual({
      org: 'configured-org',
      project: 'configured-project',
    });
    expect(result.git.commit).toBe('abc123def456');
    for (const call of mockExecFile.mock.calls) {
      expect(call[2]).toEqual({ cwd: context });
    }
  });

  it('lets a partial config override one field inferred from origin', async () => {
    gitAvailable({
      'config user.name': 'John Doe',
      'config user.email': 'john@example.com',
      'config --get remote.origin.url':
        'https://github.com/inferred-org/inferred-project.git',
      'symbolic-ref --short HEAD': 'main',
      'rev-parse HEAD': 'abc123def456',
    });

    const result = await getGitInfo('/workspace/app', { org: 'configured-org' });

    expect(result.app).toEqual({
      org: 'configured-org',
      project: 'inferred-project',
    });
  });

  it('should parse remote origin even when repository has no commits yet', async () => {
    gitAvailable({
      'config user.name': 'John Doe',
      'config user.email': 'john@example.com',
      'config --get remote.origin.url': 'git@github.com:nsttt/git-test.git',
      'symbolic-ref --short HEAD': 'main',
      // no 'rev-parse HEAD' => commit becomes no-git-commit (allowed outside CI)
    });

    const result = await getGitInfo();

    expect(result.app.org).toBe('nsttt');
    expect(result.app.project).toBe('git-test');
    expect(result.git.branch).toBe('main');
    expect(result.git.commit).toBe('no-git-commit');
    expect(mockLogFn).not.toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Git repository not found')
    );
  });

  it('should use API user org and package.json project when git is not available', async () => {
    noGitRepo();

    const result1 = await getGitInfo();
    const result2 = await getGitInfo();

    // Should use API user org when git is not available
    expect(result1.app.org).toBe('api-user');
    expect(result2.app.org).toBe('api-user');
    // Project names should come from package.json
    expect(result1.app.project).toBe('test-project');
    expect(result2.app.project).toBe('test-project');
  });

  describe('package.json naming scenarios', () => {
    it('should extract project and app name from scoped package', async () => {
      mockGetPackageJson.mockResolvedValue({
        name: '@my-scope/my-app-name',
        version: '1.0.0',
      });

      noGitRepo();

      const result = await getGitInfo();

      expect(result.app.org).toBe('api-user');
      expect(result.app.project).toBe('my-scope'); // extracted from @my-scope/my-app-name
    });

    it('should use username from API when available', async () => {
      // Mock API response with specific user info
      const { makeRequest } = require('../../http/http-request');
      makeRequest.mockResolvedValue([
        true,
        null,
        {
          value: {
            name: 'Custom User',
            email: 'custom@example.com',
            id: 'custom-123',
          },
        },
      ]);

      noGitRepo();

      const result = await getGitInfo();

      expect(result.app.org).toBe('custom-user'); // should use sanitized username from API
      expect(result.app.project).toBe('test-project');
    });

    it('should sanitize org name with special characters', async () => {
      // Mock API response with special characters
      const { makeRequest } = require('../../http/http-request');
      makeRequest.mockResolvedValue([
        true,
        null,
        {
          value: {
            name: 'Néstor López', // Contains special characters
            email: 'nestor@example.com',
            id: 'nestor-123',
          },
        },
      ]);

      noGitRepo();

      const result = await getGitInfo();

      expect(result.app.org).toBe('n-stor-l-pez'); // should sanitize special characters
      expect(result.app.project).toBe('test-project');
    });
  });
});
