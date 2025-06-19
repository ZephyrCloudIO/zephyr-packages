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
    expect(result.app.org).toMatch(/^global-[a-f0-9]{8}$/); // auto-generated org
    expect(mockLogFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Git repository not found')
    );
    expect(mockLogFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Using auto-generated org')
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
    expect(result.app.org).toMatch(/^anonymous-[a-f0-9]{8}$/); // auto-generated unique ID per machine
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

  it('should generate unique org names for anonymous users on the same machine', async () => {
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

    // Should be consistent on the same machine
    expect(result1.app.org).toBe(result2.app.org);
    // Should be anonymous with a machine-specific hash
    expect(result1.app.org).toMatch(/^anonymous-[a-f0-9]{8}$/);
  });
});
