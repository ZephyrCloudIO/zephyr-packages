import { rs } from '@rstest/core';
import { getGitInfo } from '../ze-util-get-git-info';

const jest = rs;
const {
  mockExec,
  mockGitLog,
  mockLogFn,
  mockGetPackageJson,
  mockGetToken,
  mockIsTokenStillValid,
  mockMakeRequest,
} = rs.hoisted(() => ({
  mockExec: rs.fn(),
  mockGitLog: rs.fn(),
  mockLogFn: rs.fn(),
  mockGetPackageJson: rs.fn(),
  mockGetToken: rs.fn(),
  mockIsTokenStillValid: rs.fn(),
  mockMakeRequest: rs.fn(),
}));

rs.mock('node:child_process', () => ({
  exec: mockExec,
}));

rs.mock('../../node-persist/secret-token', () => ({
  hasSecretToken: rs.fn().mockReturnValue(false),
  getSecretToken: rs.fn().mockReturnValue(''),
}));

rs.mock('../../logging', () => ({
  ze_log: {
    git: mockGitLog,
  },
}));

rs.mock('../../logging/ze-log-event', () => ({
  logFn: mockLogFn,
}));

rs.mock('is-ci', () => false);

rs.mock('../ze-util-read-package-json', () => ({
  getPackageJson: mockGetPackageJson,
}));

rs.mock('../../node-persist/token', () => ({
  getToken: mockGetToken,
}));

rs.mock('../../http/http-request', () => ({
  makeRequest: mockMakeRequest,
}));

rs.mock('../../auth/login', () => ({
  isTokenStillValid: mockIsTokenStillValid,
}));

rs.mock('../detect-monorepo', () => ({
  detectMonorepo: rs
    .fn()
    .mockResolvedValue({ type: 'none', root: process.cwd() }),
  getMonorepoRootPackageJson: rs.fn().mockResolvedValue(null),
}));

describe('getGitInfo - non-git environments', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set NODE_ENV to production for tests expecting 'main' branch
    process.env.NODE_ENV = 'production';
    mockGetPackageJson.mockResolvedValue({
      name: 'test-project',
      version: '1.0.0',
    });

    // Default token setup
    mockGetToken.mockResolvedValue('valid-token');
    mockIsTokenStillValid.mockReturnValue(true);
    mockMakeRequest.mockResolvedValue([
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
          return Promise.resolve({
            stdout: 'global@example.com\n',
            stderr: '',
          });
        } else {
          return Promise.reject(new Error('Not a git repository'));
        }
      }
    });

    const result = await getGitInfo();

    expect(result.git.name).toBe('Global User');
    expect(result.git.email).toBe('global@example.com');
    expect(result.git.branch).toMatch(/^global-git-\d{17}$/);
    expect(result.git.commit).toBe('no-git-commit');
    expect(result.app.org).toBe('global-user'); // org should be sanitized username for personal zephyr org
    expect(result.app.project).toBe('test-project'); // from package.json
  });

  it('should fall back to API user info when neither local nor global git available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      if (typeof callback === 'function') {
        callback(
          new Error('Not a git repository'),
          '',
          'fatal: not a git repository'
        );
      } else {
        return Promise.reject(new Error('Not a git repository'));
      }
    });

    const result = await getGitInfo();

    expect(result.git.name).toBe('API User');
    expect(result.git.email).toBe('api@example.com');
    expect(result.git.branch).toMatch(/^no-git-user-123-\d{17}$/);
    expect(result.git.commit).toMatch(/^fallback-deployment-\d+$/);
    expect(result.app.org).toBe('api-user'); // org should be sanitized API username
    expect(result.app.project).toBe('test-project'); // from package.json
  });

  it('should still work normally when git is available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      // Extract the delimiter from the command - now it's a static string
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
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

  it('should parse remote origin even when repository has no commits yet', async () => {
    mockExec.mockImplementation((_cmd, callback) => {
      const delimiter = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';
      const output = [
        'John Doe',
        'john@example.com',
        'git@github.com:nsttt/git-test.git',
        'main',
        'no-git-commit',
        '',
      ].join(`\n${delimiter}\n`);
      callback(null, { stdout: output, stderr: '' });
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
    mockExec.mockImplementation((cmd, callback) => {
      if (typeof callback === 'function') {
        callback(
          new Error('Not a git repository'),
          '',
          'fatal: not a git repository'
        );
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
          callback(
            new Error('Not a git repository'),
            '',
            'fatal: not a git repository'
          );
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
      mockMakeRequest.mockResolvedValue([
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
          callback(
            new Error('Not a git repository'),
            '',
            'fatal: not a git repository'
          );
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
      mockMakeRequest.mockResolvedValue([
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
          callback(
            new Error('Not a git repository'),
            '',
            'fatal: not a git repository'
          );
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
