import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import { exec as node_exec } from 'node:child_process';
import { getGitInfo } from '../ze-util-get-git-info';

rs.mock('node:child_process', () => ({
  exec: rs.fn(),
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

describe('getGitInfo - CI environments', () => {
  const mockExec = node_exec as unknown as Mock;
  type ExecCallback = (error: Error | null, stdout?: unknown, stderr?: string) => void;
  const mockExecWithCallback = (
    implementation: (command: string, callback: ExecCallback) => unknown
  ) => {
    mockExec.mockImplementation(
      (command: string, optionsOrCallback: unknown, callback?: ExecCallback) => {
        const resolvedCallback =
          typeof optionsOrCallback === 'function'
            ? (optionsOrCallback as ExecCallback)
            : callback;
        if (!resolvedCallback) throw new Error('expected child_process.exec callback');
        return implementation(command, resolvedCallback);
      }
    );
  };

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
    mockExecWithCallback((cmd, callback) => {
      if (typeof callback === 'function') {
        callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
      } else {
        return Promise.reject(new Error('Not a git repository'));
      }
    });

    await expect(getGitInfo()).rejects.toThrow();
    try {
      await getGitInfo();
    } catch (error) {
      expect((error as Error).message).toContain(
        'Stable Git branch and commit information is required in CI environments'
      );
    }
  });

  it('does not let configured identity create timestamp metadata in CI', async () => {
    mockExecWithCallback((_cmd, callback) => {
      callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
    });

    await expect(
      getGitInfo('/workspace/configured-no-git', {
        org: 'configured-org',
        project: 'configured-project',
      })
    ).rejects.toThrow(
      'Stable Git branch and commit information is required in CI environments'
    );
    expect(
      mockExec.mock.calls.some(([command]) => String(command).includes('--global'))
    ).toBe(false);
  });

  it('should work normally in CI when git is available', async () => {
    mockExecWithCallback((cmd, callback) => {
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      const output = [
        'CI User',
        'ci@example.com',
        'https://github.com/example/repo.git',
        'main',
        'abc123def456',
        'v1.0.0',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
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
    mockExecWithCallback((cmd, callback) => {
      if (cmd.includes('git tag --points-at HEAD')) {
        callback(null, { stdout: '', stderr: '' });
        return;
      }
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      callback(null, {
        stdout: ['CI User', 'ci@example.com', '', 'main', 'abc123def456'].join(
          `\n${delimiter}\n`
        ),
        stderr: '',
      });
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
    for (const call of mockExec.mock.calls) {
      expect(call[1]).toEqual({ cwd: context });
    }
  });

  it('should use last commit author in CI instead of git config', async () => {
    let capturedCommand = '';
    mockExecWithCallback((cmd, callback) => {
      if (cmd.includes('git tag --points-at HEAD')) {
        callback(null, { stdout: 'v1.0.0\n', stderr: '' });
        return;
      }
      capturedCommand = cmd;
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      const output = [
        'Last Committer',
        'committer@example.com',
        'https://github.com/example/repo.git',
        'main',
        'abc123def456',
        'v1.0.0',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
    });

    await getGitInfo();

    // In CI, should use git log instead of git config for user info
    expect(capturedCommand).toContain("git log -1 --pretty=format:'%an'");
    expect(capturedCommand).toContain("git log -1 --pretty=format:'%ae'");
    expect(capturedCommand).not.toContain('git config user.name');
    expect(capturedCommand).not.toContain('git config user.email');
  });

  it('should detect branch from GitHub Actions env vars when git returns HEAD', async () => {
    // Set up GitHub Actions environment
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_REF_NAME = 'feature/ci-branch';
    process.env.GITHUB_REF = 'refs/heads/feature/ci-branch';

    mockExecWithCallback((cmd, callback) => {
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      const output = [
        'CI User',
        'ci@example.com',
        'https://github.com/example/repo.git',
        'HEAD', // Detached HEAD state in CI
        'abc123def456',
        '',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
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

    mockExecWithCallback((cmd, callback) => {
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      const output = [
        'GitLab Runner',
        'runner@gitlab.com',
        'https://gitlab.com/example/project.git',
        'HEAD', // Detached HEAD state
        'def456abc123',
        '',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
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

    mockExecWithCallback((cmd, callback) => {
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      const output = [
        'Azure Runner',
        'runner@dev.azure.com',
        'git@ssh.dev.azure.com:v3/BusinessDomain/AddSecure/AddSecure',
        'HEAD',
        'azure123abc',
        '',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
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

    mockExecWithCallback((cmd, callback) => {
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      const output = [
        'PR Author',
        'author@example.com',
        'https://github.com/example/repo.git',
        'HEAD', // PR merge refs are detached
        'merge123abc',
        '',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
    });

    const result = await getGitInfo();

    expect(result.git.branch).toBe('feature/pull-request'); // Should use PR source branch
    expect(result.git.commit).toBe('merge123abc');
  });

  it('should use git branch when CI env vars are not available', async () => {
    // No CI env vars set, only is-ci returns true
    mockExecWithCallback((cmd, callback) => {
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      const output = [
        'Developer',
        'dev@example.com',
        'https://github.com/example/repo.git',
        'feature/actual-branch', // Git can still resolve branch sometimes
        'abc123',
        '',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
    });

    const result = await getGitInfo();

    expect(result.git.branch).toBe('feature/actual-branch'); // Should use git result
  });

  it('fails closed when detached CI has no provider branch metadata', async () => {
    mockExecWithCallback((cmd, callback) => {
      if (cmd.includes('git tag --points-at HEAD')) {
        callback(null, { stdout: '', stderr: '' });
        return;
      }
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      const output = [
        'CI User',
        'ci@example.com',
        'https://github.com/example/repo.git',
        'HEAD',
        'abc123def456',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
    });

    await expect(getGitInfo()).rejects.toThrow(
      'Stable Git branch and commit information is required in CI environments'
    );
  });

  it('should fail in CI when repository has no commits yet', async () => {
    mockExecWithCallback((_cmd, callback) => {
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      const output = [
        'CI User',
        'ci@example.com',
        'https://github.com/example/repo.git',
        'main',
        'no-git-commit',
        '',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
    });

    await expect(getGitInfo()).rejects.toThrow(
      'Stable Git branch and commit information is required in CI environments'
    );
  });
});
