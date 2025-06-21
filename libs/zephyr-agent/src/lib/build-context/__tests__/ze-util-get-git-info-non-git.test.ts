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

jest.mock('../ze-util-interactive-prompts', () => ({
  isInteractiveTerminal: jest.fn().mockReturnValue(false),
  promptForGitInfo: jest.fn(),
}));

jest.mock('../ze-styled-prompts', () => ({
  zephyrPrompt: jest.fn(),
  validateOrgName: jest.fn(),
  validateProjectName: jest.fn(),
}));

jest.mock('../ze-git-info-cache', () => ({
  getCachedGitInfo: jest.fn().mockReturnValue(null),
  setCachedGitInfo: jest.fn(),
  getGitInfoPromise: jest.fn().mockReturnValue(null),
  setGitInfoPromise: jest.fn(),
  clearGitInfoCache: jest.fn(),
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

    // Reset interactive terminal mock to false by default
    const { isInteractiveTerminal } = require('../ze-util-interactive-prompts');
    isInteractiveTerminal.mockReturnValue(false);

    // Reset cache mocks
    const { getCachedGitInfo, getGitInfoPromise } = require('../ze-git-info-cache');
    getCachedGitInfo.mockReturnValue(null);
    getGitInfoPromise.mockReturnValue(null);
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
      'error',
      expect.stringContaining('Git repository not found. Zephyr REQUIRES git')
    );
    expect(mockLogFn).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Organization will be determined from your account')
    );
    expect(mockLogFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('To properly use Zephyr')
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

    expect(result.git.name).toBe('zephyr-deploy');
    expect(result.git.email).toBe('deploy@zephyr-cloud.io');
    expect(result.git.branch).toBe('main');
    expect(result.git.commit).toMatch(/^fallback-deployment-\d+$/);
    expect(result.app.org).toBe(''); // org should be empty when git remote is not available
    // For non-interactive fallback, should show critical error messages
    expect(mockLogFn).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('CRITICAL: Git not available')
    );
    expect(mockLogFn).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Using fallback project name')
    );
    expect(mockLogFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Zephyr REQUIRES: git init')
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

  describe('interactive terminal scenarios', () => {
    it('should prompt for org and project when git repo not available but global git config exists', async () => {
      const {
        isInteractiveTerminal,
        promptForGitInfo,
      } = require('../ze-util-interactive-prompts');
      isInteractiveTerminal.mockReturnValue(true);
      promptForGitInfo.mockResolvedValue({ org: 'my-org', project: 'my-project' });

      mockExec.mockImplementation((cmd, callback) => {
        if (typeof callback === 'function') {
          // Mock exec with callback
          if (cmd.includes('git config --global user.name')) {
            callback(null, { stdout: 'Global User\n', stderr: '' });
          } else if (cmd.includes('git config --global user.email')) {
            callback(null, { stdout: 'global@example.com\n', stderr: '' });
          } else {
            callback(
              new Error('Not a git repository'),
              '',
              'fatal: not a git repository'
            );
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
      expect(result.app.org).toBe('my-org');
      expect(result.app.project).toBe('my-project');
      expect(promptForGitInfo).toHaveBeenCalled();
      expect(mockLogFn).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Git repository not found. Zephyr REQUIRES')
      );
    });

    it('should prompt for org and project when neither local nor global git available', async () => {
      const {
        isInteractiveTerminal,
        promptForGitInfo,
      } = require('../ze-util-interactive-prompts');
      isInteractiveTerminal.mockReturnValue(true);
      promptForGitInfo.mockResolvedValue({
        org: 'prompted-org',
        project: 'prompted-project',
      });

      mockExec.mockImplementation((cmd, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
        } else {
          return Promise.reject(new Error('Not a git repository'));
        }
      });

      const result = await getGitInfo();

      expect(result.git.name).toBe('zephyr-deploy');
      expect(result.git.email).toBe('deploy@zephyr-cloud.io');
      expect(result.app.org).toBe('prompted-org');
      expect(result.app.project).toBe('prompted-project');
      expect(promptForGitInfo).toHaveBeenCalled();
      expect(mockLogFn).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Git not available. Zephyr REQUIRES git')
      );
    });
  });

  describe('caching behavior', () => {
    it('should return cached git info if available', async () => {
      const cachedInfo = {
        git: {
          name: 'Cached User',
          email: 'cached@example.com',
          branch: 'cached-branch',
          commit: 'cached-commit',
          tags: [],
        },
        app: {
          org: 'cached-org',
          project: 'cached-project',
        },
      };

      const { getCachedGitInfo } = require('../ze-git-info-cache');
      getCachedGitInfo.mockReturnValue(cachedInfo);

      const result = await getGitInfo();

      expect(result).toEqual(cachedInfo);
      // Should not execute any git commands when cache is available
      expect(mockExec).not.toHaveBeenCalled();
    });

    it('should cache git info after first successful fetch', async () => {
      const { setCachedGitInfo } = require('../ze-git-info-cache');

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

      await getGitInfo();

      expect(setCachedGitInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          git: expect.objectContaining({
            name: 'John Doe',
            email: 'john@example.com',
          }),
          app: expect.objectContaining({
            org: 'example',
            project: 'repo',
          }),
        })
      );
    });
  });
});
