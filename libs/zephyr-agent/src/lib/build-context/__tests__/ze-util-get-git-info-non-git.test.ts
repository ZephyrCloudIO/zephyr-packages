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

jest.mock('is-ci', () => false);

describe('getGitInfo - non-git environments', () => {
  const mockExec = node_exec as unknown as jest.Mock;
  let mockGitLog: jest.Mock;
  let mockLogFn: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the mocked ze_log.git function
    const { ze_log } = require('../../logging');
    mockGitLog = ze_log.git;
    mockGitLog.mockClear();

    // Get the mocked logFn function
    const { logFn } = require('../../logging/ze-log-event');
    mockLogFn = logFn;
    mockLogFn.mockClear();
  });

  it('should fall back to global git config when local repo not available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      if (typeof callback === 'function') {
        // Mock exec with callback
        if (cmd.includes('git config --global user.name')) {
          callback(null, { stdout: 'Global User\n', stderr: '' });
        } else if (cmd.includes('git config --global user.email')) {
          callback(null, { stdout: 'global@example.com\n', stderr: '' });
        } else {
          callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
        }
      } else {
        // Mock promisified exec
        if (cmd.includes('git config --global user.name')) {
          return Promise.resolve({ stdout: 'Global User\n', stderr: '' });
        } else if (cmd.includes('git config --global user.email')) {
          return Promise.resolve({ stdout: 'global@example.com\n', stderr: '' });
        } else {
          return Promise.reject(new Error('Not a git repository'));
        }
      }
    });

    const result = await getGitInfo();

    expect(result.git.name).toBe('Global User');
    expect(result.git.email).toBe('global@example.com');
    expect(result.git.branch).toBe('main');
    expect(result.git.commit).toBe('no-git-commit');
    expect(result.app.org).toBe(''); // org should be empty when git remote is not available
    expect(mockLogFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Git repository not found')
    );
    expect(mockLogFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Organization will be determined from your account')
    );
    expect(mockLogFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('initialize a git repository')
    );
  });

  it('should fall back to defaults when neither local nor global git available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      if (typeof callback === 'function') {
        callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
      } else {
        return Promise.reject(new Error('Not a git repository'));
      }
    });

    const result = await getGitInfo();

    expect(result.git.name).toBe('anonymous');
    expect(result.git.email).toBe('anonymous@zephyr-cloud.io');
    expect(result.git.branch).toBe('main');
    expect(result.git.commit).toBe('no-git-commit');
    expect(result.app.org).toBe(''); // org should be empty when git remote is not available
    expect(mockLogFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Git repository not found')
    );
    expect(mockLogFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Global git config not found')
    );
    expect(mockLogFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('initialize a git repository')
    );
  });

  it('should still work normally when git is available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      const delimiter = cmd.match(/echo ([a-f0-9-]+) &&/)?.[1] || '';
      const output = [
        'John Doe',
        'john@example.com',
        'https://github.com/example/repo.git',
        'main',
        'abc123def456',
        'v1.0.0',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
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

  it('should always use empty org when git is not available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      if (typeof callback === 'function') {
        callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
      } else {
        return Promise.reject(new Error('Not a git repository'));
      }
    });

    // Don't set any environment variables - should use anonymous defaults
    const result1 = await getGitInfo();
    const result2 = await getGitInfo();

    // Should always use empty string when git is not available
    expect(result1.app.org).toBe('');
    expect(result2.app.org).toBe('');
    // Project names should still be generated from current directory
    expect(result1.app.project).toBeTruthy();
    expect(result2.app.project).toBeTruthy();
  });
});
