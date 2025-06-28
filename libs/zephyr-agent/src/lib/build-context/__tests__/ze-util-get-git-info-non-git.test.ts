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

jest.mock('../../auth/login', () => ({
  isTokenStillValid: jest.fn(),
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
  let mockGetPackageJson: jest.Mock;

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

    // Reset package.json mock
    const { getPackageJson } = require('../ze-util-read-package-json');
    mockGetPackageJson = getPackageJson;
    mockGetPackageJson.mockResolvedValue({
      name: 'test-project',
      version: '1.0.0',
    });

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
    expect(result.app.org).toBe('global-user'); // org should be sanitized username for personal zephyr org
    expect(result.app.project).toBe('test-project'); // from package.json
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
    expect(result.app.org).toBe('personal'); // org should be 'personal' for personal zephyr org
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

  it('should use personal org and package.json project when git is not available', async () => {
    mockExec.mockImplementation((cmd, callback) => {
      if (typeof callback === 'function') {
        callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
      } else {
        return Promise.reject(new Error('Not a git repository'));
      }
    });

    const result1 = await getGitInfo();
    const result2 = await getGitInfo();

    // Should use 'personal' org when git is not available and no token username
    expect(result1.app.org).toBe('personal');
    expect(result2.app.org).toBe('personal');
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

      expect(result.app.org).toBe('personal');
      expect(result.app.project).toBe('my-scope'); // extracted from @my-scope/my-app-name
    });

    it('should use username from token when available', async () => {
      // Mock token functionality
      const mockToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoidGVzdC11c2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.test';
      const { getToken } = require('../../node-persist/token');
      const { isTokenStillValid } = require('../../auth/login');
      const getTokenMock = getToken as jest.Mock;
      const isTokenStillValidMock = isTokenStillValid as jest.Mock;

      getTokenMock.mockResolvedValue(mockToken);
      isTokenStillValidMock.mockReturnValue(true);

      // Mock jwt decode
      const jose = require('jose');
      const joseDecodeMock = jest.spyOn(jose, 'decodeJwt');
      joseDecodeMock.mockReturnValue({
        name: 'test-user-from-token',
        email: 'test@example.com',
      });

      mockExec.mockImplementation((cmd, callback) => {
        if (typeof callback === 'function') {
          callback(new Error('Not a git repository'), '', 'fatal: not a git repository');
        } else {
          return Promise.reject(new Error('Not a git repository'));
        }
      });

      const result = await getGitInfo();

      expect(result.app.org).toBe('test-user-from-token'); // should use sanitized username from token
      expect(result.app.project).toBe('test-project');
    });

    it('should sanitize org name with special characters', async () => {
      // Mock token functionality with special characters
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const { getToken } = require('../../node-persist/token');
      const { isTokenStillValid } = require('../../auth/login');
      const getTokenMock = getToken as jest.Mock;
      const isTokenStillValidMock = isTokenStillValid as jest.Mock;

      getTokenMock.mockResolvedValue(mockToken);
      isTokenStillValidMock.mockReturnValue(true);

      // Mock jwt decode with special characters
      const jose = require('jose');
      const joseDecodeMock = jest.spyOn(jose, 'decodeJwt');
      joseDecodeMock.mockReturnValue({
        name: 'Néstor López', // Contains special characters
        email: 'nestor@example.com',
      });

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
