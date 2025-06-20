import { exec as node_exec } from 'node:child_process';
import { getGitInfo } from '../ze-util-get-git-info';

jest.mock('node:child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('../../node-persist/secret-token', () => ({
  hasSecretToken: jest.fn().mockReturnValue(false),
}));

jest.mock('../../logging', () => ({
  ze_log: {
    git: jest.fn(),
  },
}));

jest.mock('../../logging/ze-log-event', () => ({
  logFn: jest.fn(),
}));

// Mock is-ci to return true for CI environment testing
jest.mock('is-ci', () => true);

jest.mock('../ze-git-info-cache', () => ({
  getCachedGitInfo: jest.fn().mockReturnValue(null),
  setCachedGitInfo: jest.fn(),
  getGitInfoPromise: jest.fn().mockReturnValue(null),
  setGitInfoPromise: jest.fn(),
  clearGitInfoCache: jest.fn(),
}));

describe('getGitInfo - CI environments', () => {
  const mockExec = node_exec as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset cache mocks
    const { getCachedGitInfo, getGitInfoPromise } = require('../ze-git-info-cache');
    getCachedGitInfo.mockReturnValue(null);
    getGitInfoPromise.mockReturnValue(null);
  });

  it('should fail immediately in CI when git info is not available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
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
        'Git repository information is required in CI environments'
      );
    }
  });

  it('should work normally in CI when git is available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      const delimiter = cmd.match(/echo ([a-f0-9-]+) &&/)?.[1] || '';
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

  it('should use last commit author in CI instead of git config', async () => {
    let capturedCommand = '';
    mockExec.mockImplementation((cmd, callback) => {
      capturedCommand = cmd;
      const delimiter = cmd.match(/echo ([a-f0-9-]+) &&/)?.[1] || '';
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
});
