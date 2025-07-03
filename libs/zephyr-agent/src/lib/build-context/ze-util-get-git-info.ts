import isCI from 'is-ci';
import { exec as node_exec } from 'node:child_process';
import { sep } from 'node:path';
import { promisify } from 'node:util';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { ZE_API_ENDPOINT } from 'zephyr-edge-contract';
import { isTokenStillValid } from '../auth/login';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { logFn } from '../logging/ze-log-event';
import { hasSecretToken } from '../node-persist/secret-token';
import { getToken } from '../node-persist/token';
import { getGitProviderInfo } from './git-provider-utils';
import { detectMonorepo, getMonorepoRootPackageJson } from './detect-monorepo';
import { getPackageJson } from './ze-util-read-package-json';

const exec = promisify(node_exec);

export interface ZeGitInfo {
  app: Pick<ZephyrPluginOptions['app'], 'org' | 'project'>;
  git: ZephyrPluginOptions['git'];
}

interface UserInfo {
  name: string;
  email: string;
  id: string;
}

/** Generate branch name for non-git contexts */
function generateBranchName(context: 'global-git' | 'no-git', userId?: string): string {
  const timestamp = new Date().toISOString().replace(/\D/g, '');
  const userSuffix = userId ? `-${userId.slice(0, 8)}` : '';
  return `${context}${userSuffix}-${timestamp}`;
}

/** Loads the git information from the current repository. */
export async function getGitInfo(): Promise<ZeGitInfo> {
  // Always gather fresh git info for build accuracy
  return await gatherGitInfo();
}

/** Internal function that actually gathers git information. */
async function gatherGitInfo(): Promise<ZeGitInfo> {
  const hasToken = hasSecretToken();

  try {
    const { name, email, remoteOrigin, branch, commit, tags, stdout } =
      await loadGitInfo(hasToken);

    if (!hasToken && (!name || !email)) {
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_USERNAME_EMAIL, {
        data: { stdout },
      });
    }

    const app = parseGitUrl(remoteOrigin, stdout);

    const gitInfo = {
      git: { name, email, branch, commit, tags },
      app,
    };

    ze_log.git('Loaded: git info', gitInfo);

    return gitInfo;
  } catch (error) {
    // In CI environments, fail immediately if git info is not available
    if (isCI) {
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message: 'Git repository information is required in CI environments',
        cause: error,
      });
    }

    // If git repo info is not available, try global git config
    ze_log.git('Git repository not found, falling back to global git config');

    try {
      const globalGitInfo = await loadGlobalGitInfo();
      return globalGitInfo;
    } catch {
      // If global git config also fails, use defaults
      logFn('warn', 'Global git config not found, using auto-generated defaults');
      ze_log.git('Global git config not found, using auto-generated defaults');

      const fallbackInfo = await getFallbackGitInfo();
      return fallbackInfo;
    }
  }
}

// Static delimiter that's unique enough to avoid conflicts with git output
const GIT_OUTPUT_DELIMITER = '---ZEPHYR-GIT-DELIMITER-8f3a2b1c---';

/** Loads all data in a single command to avoid multiple executions. */
async function loadGitInfo(hasSecretToken: boolean): Promise<{
  name: string;
  email: string;
  remoteOrigin: string;
  branch: string;
  commit: string;
  tags: string[];
  stdout: string;
}> {
  const automated = isCI || hasSecretToken;

  const command = [
    // Inside CI environments, the last committer should be the actor
    // and not the actual logged git user which sometimes might just be a bot
    automated ? "git log -1 --pretty=format:'%an'" : 'git config user.name',
    automated ? "git log -1 --pretty=format:'%ae'" : 'git config user.email',
    // TODO: support remote names that are not 'origin'
    'git config --get remote.origin.url',
    'git rev-parse --abbrev-ref HEAD',
    'git rev-parse HEAD',
    'git tag --points-at HEAD',
  ].join(` && echo ${GIT_OUTPUT_DELIMITER} && `);

  try {
    const { stdout } = await exec(command);

    const [name, email, remoteOrigin, branch, commit, tagsOutput] = stdout
      .trim()
      .split(GIT_OUTPUT_DELIMITER)
      .map((x) => x.trim());
    // Parse tags - if multiple tags point to HEAD, they'll be on separate lines
    const tags = tagsOutput ? tagsOutput.split('\n').filter(Boolean) : [];

    return {
      name,
      email,
      remoteOrigin,
      branch,
      commit,
      tags,
      stdout,
    };
  } catch (cause: unknown) {
    const error = cause as Error & { stderr?: string };
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      cause,
      data: { command, delimiter: GIT_OUTPUT_DELIMITER },
      message: error?.stderr || error.message,
    });
  }
}

/**
 * Parses the git url using the `git-url-parse` package.
 *
 * This package differentiates CI providers and handles git info from various platforms
 * like GitHub, GitLab, Bitbucket, and custom git deployments.
 */
function parseGitUrl(
  remoteOrigin: string,
  stdout: string
): Pick<ZephyrPluginOptions['app'], 'org' | 'project'> {
  if (!remoteOrigin) {
    throw new ZephyrError(ZeErrors.ERR_GIT_REMOTE_ORIGIN, {
      data: { stdout },
    });
  }

  try {
    const gitInfo = getGitProviderInfo(remoteOrigin);

    ze_log.git(`Git provider detected: ${gitInfo.provider}`, {
      provider: gitInfo.provider,
      owner: gitInfo.owner,
      project: gitInfo.project,
      isEnterprise: gitInfo.isEnterprise,
    });

    return {
      org: gitInfo.owner,
      project: gitInfo.project,
    };
  } catch (cause) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message: stdout,
      cause,
      data: { stdout },
    });
  }
}

/** Try to load git info from global git config */
async function loadGlobalGitInfo(): Promise<ZeGitInfo> {
  try {
    const [nameResult, emailResult] = await Promise.all([
      exec('git config --global user.name').catch(() => ({ stdout: '' })),
      exec('git config --global user.email').catch(() => ({ stdout: '' })),
    ]);

    const name = nameResult.stdout?.trim();
    const email = emailResult.stdout?.trim();

    if (!name && !email) {
      logFn(
        'warn',
        'Global git config incomplete: both name and email are missing. Falling back to API user info.'
      );
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message: 'Global git config incomplete: both name and email are missing',
      });
    }

    if (!name) {
      logFn(
        'warn',
        'Global git config incomplete: user name is missing. Run: git config --global user.name "Your Name". Falling back to API user info.'
      );
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message: 'Global git config incomplete: user name is missing',
      });
    }

    if (!email) {
      logFn(
        'warn',
        'Global git config incomplete: user email is missing. Run: git config --global user.email "your@email.com". Falling back to API user info.'
      );
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message: 'Global git config incomplete: user email is missing',
      });
    }

    const { org, project } = await getAppNamingFromPackageJson(name);

    const gitInfo: ZeGitInfo = {
      git: {
        name,
        email,
        branch: generateBranchName('global-git'),
        commit: 'no-git-commit',
        tags: [],
      },
      app: {
        org,
        project,
      },
    };

    ze_log.git('Using global git config (no local repository)', gitInfo);

    return gitInfo;
  } catch (error) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message: 'Failed to load global git config',
      cause: error,
    });
  }
}

/** Get user info from API endpoint instead of JWT decoding */
async function getUserInfoFromAPI(): Promise<UserInfo> {
  const token = await getToken();
  if (!token || !isTokenStillValid(token, 60)) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message: 'No valid authentication token found. Please login first.',
    });
  }

  const [ok, cause, response] = await makeRequest<{ value: UserInfo }>({
    path: '/v2/user/me',
    base: ZE_API_ENDPOINT(),
    query: {},
  });

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message:
        'Failed to get user information from API. Please ensure you are logged in with a valid token.',
      cause,
    });
  }

  const userData = response.value;

  ze_log.git('Retrieved user info from API:', {
    name: userData.name,
    email: userData.email,
  });

  return userData;
}

/** Generate fallback git info when git is completely unavailable */
async function getFallbackGitInfo(): Promise<ZeGitInfo> {
  let userInfo: UserInfo;

  try {
    userInfo = await getUserInfoFromAPI();
  } catch (error) {
    ze_log.git('Failed to get user info from API:', error);
    throw error;
  }

  const gitName = userInfo.name;
  const gitEmail = userInfo.email;

  if (isCI) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message:
        'Git repository information is required in CI environments. Please ensure your CI workflow includes git repository with proper remote origin.',
    });
  }

  const { org, project } = await getAppNamingFromPackageJson(userInfo.name);

  const gitInfo: ZeGitInfo = {
    git: {
      name: gitName,
      email: gitEmail,
      branch: generateBranchName('no-git', userInfo.id),
      commit: `fallback-deployment-${Date.now()}`,
      tags: [`deployed-by:${userInfo.id}`],
    },
    app: {
      org,
      project,
    },
  };

  ze_log.git('Using fallback git info (git not available)', gitInfo);

  return gitInfo;
}

/** Sanitize string for use as org/project name */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

/** Get current directory name as project name */
function getCurrentDirectoryName(): string {
  const cwd = process.cwd();
  const dirName = cwd.split(sep).pop() || 'untitled-project';
  return sanitizeName(dirName);
}

/**
 * Extract org, project, and app names from package.json structure for non-git
 * environments
 */
async function getAppNamingFromPackageJson(
  tokenUserName?: string
): Promise<{ org: string; project: string; app: string }> {
  try {
    const packageJson = await getPackageJson(process.cwd());
    const packageName = packageJson.name;

    // Require JWT username for org - no fallback to avoid build loss
    if (!tokenUserName) {
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message:
          'Unable to determine organization: no authenticated user found. Please ensure you are logged in with a valid token.',
      });
    }
    const org = sanitizeName(tokenUserName);

    if (packageName.includes('@')) {
      // Scoped package: @scope/name -> project: scope, app: name
      const [scope, name] = packageName.split('/');
      return {
        org,
        project: scope.replace('@', ''),
        app: name,
      };
    }

    // Check if we're in a monorepo
    const monorepoInfo = await detectMonorepo(process.cwd());

    if (monorepoInfo.type !== 'none') {
      // We're in a monorepo
      const rootPackageJson = await getMonorepoRootPackageJson(monorepoInfo.root);

      if (rootPackageJson && rootPackageJson['name']) {
        const rootName = rootPackageJson['name'] as string;
        // If root package is scoped, use the scope as project
        if (rootName.includes('@')) {
          const [scope] = rootName.split('/');
          return {
            org,
            project: scope.replace('@', ''),
            app: packageName,
          };
        }
        // Use root package name as project
        return {
          org,
          project: sanitizeName(rootName),
          app: packageName,
        };
      } else {
        // No root package.json or no name - use monorepo root directory name
        const rootDirName = monorepoInfo.root.split(sep).pop() || 'monorepo';
        return {
          org,
          project: sanitizeName(rootDirName),
          app: packageName,
        };
      }
    }

    // Not in a monorepo - single package
    return {
      org,
      project: packageName,
      app: packageName,
    };
  } catch {
    // No package.json: use directory name
    const dirName = getCurrentDirectoryName();
    if (!tokenUserName) {
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message:
          'Unable to determine organization: no authenticated user found and no package.json available. Please ensure you are logged in with a valid token.',
      });
    }
    return {
      org: sanitizeName(tokenUserName),
      project: dirName,
      app: dirName,
    };
  }
}
