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

jest.mock('../ze-util-read-package-json', () => ({
  getPackageJson: jest.fn(),
}));

jest.mock('../../node-persist/token', () => ({
  getToken: jest.fn(),
}));

jest.mock('../../http/http-request', () => ({
  makeRequest: jest.fn(),
}));

jest.mock('../../auth/login', () => ({
  isTokenStillValid: jest.fn(),
}));

describe('getGitInfo - non-git environments', () => {
  const mockExec = node_exec as unknown as jest.Mock;
  let mockGitLog: jest.Mock;
  let mockLogFn: jest.Mock;
  let mockGetPackageJson: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

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
    expect(result.git.branch).toMatch(/^global-git-\d{8}T\d{6}$/);
    expect(result.git.commit).toBe('no-git-commit');
    expect(result.app.org).toBe('global-user'); // org should be sanitized username for personal zephyr org
    expect(result.app.project).toBe('test-project'); // from package.json
  });

  it('should fall back to API user info when neither local nor global git available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      if (typeof callback === 'function') {
        callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
      } else {
        return Promise.reject(new Error('Not a git repository'));
      }
    });

    const result = await getGitInfo();

    expect(result.git.name).toBe('API User');
    expect(result.git.email).toBe('api@example.com');
    expect(result.git.branch).toMatch(/^no-git-user-123-\d{8}T\d{6}$/);
    expect(result.git.commit).toMatch(/^fallback-deployment-\d+$/);
    expect(result.app.org).toBe('api-user'); // org should be sanitized API username
    expect(result.app.project).toBe('test-project'); // from package.json
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

  it('should use API user org and package.json project when git is not available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      if (typeof callback === 'function') {
        callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
      } else {
        return Promise.reject(new Error('Not a git repository'));
      }
    });

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

      mockExec.mockImplementation((cmd, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
        } else {
          return Promise.reject(new Error('Not a git repository'));
        }
      });

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

      mockExec.mockImplementation((cmd, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
        } else {
          return Promise.reject(new Error('Not a git repository'));
        }
      });

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

      mockExec.mockImplementation((cmd, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
        } else {
          return Promise.reject(new Error('Not a git repository'));
        }
      });

      const result = await getGitInfo();

      expect(result.app.org).toBe('n-stor-l-pez'); // should sanitize special characters
      expect(result.app.project).toBe('test-project');
    });
  });
});
