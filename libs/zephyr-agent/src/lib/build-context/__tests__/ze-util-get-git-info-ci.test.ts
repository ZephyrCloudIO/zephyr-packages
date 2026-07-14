import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
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

// Mock is-ci to return true for CI environment testing
rs.mock('is-ci', () => ({ default: true }));

let originalEnv: NodeJS.ProcessEnv;

/**
 * Maps a git subcommand (arg list) to the stdout it should produce.
 *
 * Any command not present in the map resolves to empty output, which mirrors a git
 * command that exited non-zero (the source treats that as "unavailable").
 */
type GitOutputs = Record<string, string>;

describe('getGitInfo - CI environments', () => {
  const mockExecFile = node_execFile as unknown as Mock;
  type ExecCallback = (error: Error | null, stdout?: unknown, stderr?: string) => void;

  /**
   * ExecFile is called as execFile('git', args, options, callback). This helper lets each
   * test respond based on the git args instead of a single chained shell string, matching
   * the per-command implementation.
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

  /** Convenience builder for the common "git is available" scenario. */
  const gitAvailable = (outputs: GitOutputs) =>
    mockGit((args) => {
      const key = args.join(' ');
      if (key in outputs) return { stdout: outputs[key] };
      return { stdout: '' };
    });

  beforeEach(() => {
    rs.clearAllMocks();
    originalEnv = { ...process.env };
    // Clear CI env vars
    Object.keys(process.env).forEach((key) => {
      if (
        key.startsWith('GITHUB_') ||
        key.startsWith('GITLAB_') ||
        key.startsWith('BUILD_') ||
        key.startsWith('SYSTEM_') ||
        key.startsWith('TF_')
      ) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should fail immediately in CI when git info is not available', async () => {
    // Every git command fails => not a git repository.
    mockGit(() => ({ error: new Error('Not a git repository') }));

    await expect(getGitInfo()).rejects.toThrow(
      'Stable Git branch and commit information is required in CI environments'
    );
  });

  it('does not let configured identity create timestamp metadata in CI', async () => {
    mockGit(() => ({ error: new Error('Not a git repository') }));

    await expect(
      getGitInfo('/workspace/configured-no-git', {
        org: 'configured-org',
        project: 'configured-project',
      })
    ).rejects.toThrow(
      'Stable Git branch and commit information is required in CI environments'
    );
    expect(
      mockExecFile.mock.calls.some(([, args]) => (args as string[]).includes('--global'))
    ).toBe(false);
  });

  it('should work normally in CI when git is available', async () => {
    gitAvailable({
      'log -1 --pretty=format:%an': 'CI User',
      'log -1 --pretty=format:%ae': 'ci@example.com',
      'config --get remote.origin.url': 'https://github.com/example/repo.git',
      'symbolic-ref --short HEAD': 'main',
      'rev-parse HEAD': 'abc123def456',
      'tag --points-at HEAD': 'v1.0.0',
    });

    const result = await getGitInfo();

    expect(result.git.name).toBe('CI User');
    expect(result.git.email).toBe('ci@example.com');
    expect(result.git.branch).toBe('main');
    expect(result.git.commit).toBe('abc123def456');
    expect(result.git.tags).toEqual(['v1.0.0']);
    expect(result.app.org).toBe('example');
    expect(result.app.project).toBe('repo');
  });

  it('uses configured identity when CI has commit metadata but no origin', async () => {
    const context = '/workspace/apps/configured-ci';
    gitAvailable({
      'log -1 --pretty=format:%an': 'CI User',
      'log -1 --pretty=format:%ae': 'ci@example.com',
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

  it('should use last commit author in CI instead of git config', async () => {
    const capturedArgs: string[][] = [];
    mockGit((args) => {
      capturedArgs.push(args);
      const outputs: GitOutputs = {
        'log -1 --pretty=format:%an': 'Last Committer',
        'log -1 --pretty=format:%ae': 'committer@example.com',
        'config --get remote.origin.url': 'https://github.com/example/repo.git',
        'symbolic-ref --short HEAD': 'main',
        'rev-parse HEAD': 'abc123def456',
        'tag --points-at HEAD': 'v1.0.0',
      };
      const key = args.join(' ');
      return { stdout: key in outputs ? outputs[key] : '' };
    });

    await getGitInfo();

    const joined = capturedArgs.map((args) => args.join(' '));
    // In CI, should use git log instead of git config for user info
    expect(joined).toContain('log -1 --pretty=format:%an');
    expect(joined).toContain('log -1 --pretty=format:%ae');
    expect(joined).not.toContain('config user.name');
    expect(joined).not.toContain('config user.email');
  });

  it('should detect branch from GitHub Actions env vars when git returns HEAD', async () => {
    // Set up GitHub Actions environment
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_REF_NAME = 'feature/ci-branch';
    process.env.GITHUB_REF = 'refs/heads/feature/ci-branch';

    gitAvailable({
      'log -1 --pretty=format:%an': 'CI User',
      'log -1 --pretty=format:%ae': 'ci@example.com',
      'config --get remote.origin.url': 'https://github.com/example/repo.git',
      'symbolic-ref --short HEAD': 'HEAD', // Detached HEAD state in CI
      'rev-parse HEAD': 'abc123def456',
    });

    const result = await getGitInfo();

    expect(result.git.branch).toBe('feature/ci-branch'); // Should use CI env var
    expect(result.git.name).toBe('CI User');
    expect(result.git.email).toBe('ci@example.com');
    expect(result.git.commit).toBe('abc123def456');
    expect(result.app.org).toBe('example');
    expect(result.app.project).toBe('repo');
  });

  it('should detect branch from GitLab CI env vars when git returns HEAD', async () => {
    // Set up GitLab CI environment
    process.env.GITLAB_CI = 'true';
    process.env.CI_COMMIT_BRANCH = 'develop';
    process.env.CI_COMMIT_REF_NAME = 'develop';

    gitAvailable({
      'log -1 --pretty=format:%an': 'GitLab Runner',
      'log -1 --pretty=format:%ae': 'runner@gitlab.com',
      'config --get remote.origin.url': 'https://gitlab.com/example/project.git',
      'symbolic-ref --short HEAD': 'HEAD', // Detached HEAD state
      'rev-parse HEAD': 'def456abc123',
    });

    const result = await getGitInfo();

    expect(result.git.branch).toBe('develop');
    expect(result.git.commit).toBe('def456abc123');
    expect(result.app.org).toBe('example');
    expect(result.app.project).toBe('project');
  });

  it('should support Azure Pipelines with Azure DevOps SSH remotes', async () => {
    process.env.TF_BUILD = 'True';
    process.env.BUILD_SOURCEBRANCHNAME = 'feature/azure';
    process.env.BUILD_SOURCEBRANCH = 'refs/heads/feature/azure';

    gitAvailable({
      'log -1 --pretty=format:%an': 'Azure Runner',
      'log -1 --pretty=format:%ae': 'runner@dev.azure.com',
      'config --get remote.origin.url':
        'git@ssh.dev.azure.com:v3/BusinessDomain/AddSecure/AddSecure',
      'symbolic-ref --short HEAD': 'HEAD',
      'rev-parse HEAD': 'azure123abc',
    });

    const result = await getGitInfo();

    expect(result.git.branch).toBe('feature/azure');
    expect(result.git.commit).toBe('azure123abc');
    expect(result.app.org).toBe('businessdomain');
    expect(result.app.project).toBe('addsecure');
  });

  it('should detect PR source branch from GitHub Actions env vars', async () => {
    // Set up GitHub Actions PR environment
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_HEAD_REF = 'feature/pull-request';
    process.env.GITHUB_BASE_REF = 'main';
    process.env.GITHUB_REF = 'refs/pull/123/merge';

    gitAvailable({
      'log -1 --pretty=format:%an': 'PR Author',
      'log -1 --pretty=format:%ae': 'author@example.com',
      'config --get remote.origin.url': 'https://github.com/example/repo.git',
      'symbolic-ref --short HEAD': 'HEAD', // PR merge refs are detached
      'rev-parse HEAD': 'merge123abc',
    });

    const result = await getGitInfo();

    expect(result.git.branch).toBe('feature/pull-request'); // Should use PR source branch
    expect(result.git.commit).toBe('merge123abc');
  });

  it('should use git branch when CI env vars are not available', async () => {
    // No CI env vars set, only is-ci returns true
    gitAvailable({
      'log -1 --pretty=format:%an': 'Developer',
      'log -1 --pretty=format:%ae': 'dev@example.com',
      'config --get remote.origin.url': 'https://github.com/example/repo.git',
      'symbolic-ref --short HEAD': 'feature/actual-branch',
      'rev-parse HEAD': 'abc123',
    });

    const result = await getGitInfo();

    expect(result.git.branch).toBe('feature/actual-branch'); // Should use git result
  });

  it('fails closed when detached CI has no provider branch metadata', async () => {
    gitAvailable({
      'log -1 --pretty=format:%an': 'CI User',
      'log -1 --pretty=format:%ae': 'ci@example.com',
      'config --get remote.origin.url': 'https://github.com/example/repo.git',
      'symbolic-ref --short HEAD': 'HEAD',
      'rev-parse HEAD': 'abc123def456',
    });

    await expect(getGitInfo()).rejects.toThrow(
      'Stable Git branch and commit information is required in CI environments'
    );
  });

  it('should fail in CI when repository has no commits yet', async () => {
    // rev-parse HEAD fails on an unborn branch (no commits).
    gitAvailable({
      'log -1 --pretty=format:%an': 'CI User',
      'log -1 --pretty=format:%ae': 'ci@example.com',
      'config --get remote.origin.url': 'https://github.com/example/repo.git',
      'symbolic-ref --short HEAD': 'main',
      // no 'rev-parse HEAD' entry => empty => no-git-commit
    });

    await expect(getGitInfo()).rejects.toThrow(
      'Stable Git branch and commit information is required in CI environments'
    );
  });

  it('reads the commit hash even when other subcommands emit unusual output (windows regression)', async () => {
    // Regression for a shell-precedence bug where chaining git reads with
    // `&&`/`||` in a single cmd.exe command dropped the commit hash on Windows.
    // Running each command independently keeps the commit populated.
    gitAvailable({
      'log -1 --pretty=format:%an': 'CI User',
      'log -1 --pretty=format:%ae': 'ci@example.com',
      'config --get remote.origin.url': 'https://github.com/example/repo.git',
      'symbolic-ref --short HEAD': 'main',
      'rev-parse HEAD': 'deadbeefcafe1234',
    });

    const result = await getGitInfo();

    expect(result.git.commit).toBe('deadbeefcafe1234');
    expect(result.git.branch).toBe('main');
    // Each read is a discrete execFile call - never a single chained shell string.
    for (const call of mockExecFile.mock.calls) {
      expect(call[0]).toBe('git');
      expect(Array.isArray(call[1])).toBe(true);
    }
  });
});
