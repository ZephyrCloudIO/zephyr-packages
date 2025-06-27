import isCI from 'is-ci';
import * as jose from 'jose';
import { exec as node_exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { isTokenStillValid } from '../auth/login';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { logFn } from '../logging/ze-log-event';
import { hasSecretToken } from '../node-persist/secret-token';
import { getToken } from '../node-persist/token';
import { getGitProviderInfo } from './git-provider-utils';
import {
  getCachedGitInfo,
  getGitInfoPromise,
  setCachedGitInfo,
  setGitInfoPromise,
} from './ze-git-info-cache';
import { getPackageJson } from './ze-util-read-package-json';

const exec = promisify(node_exec);

export interface ZeGitInfo {
  app: Pick<ZephyrPluginOptions['app'], 'org' | 'project'>;
  git: ZephyrPluginOptions['git'];
}

/** Loads the git information from the current repository. */
export async function getGitInfo(): Promise<ZeGitInfo> {
  // Check if we already have cached git info
  const cached = getCachedGitInfo();
  if (cached) {
    ze_log.git('Using cached git info');
    return cached;
  }

  // Check if another call is already gathering git info
  const existingPromise = getGitInfoPromise();
  if (existingPromise) {
    ze_log.git('Waiting for existing git info gathering to complete');
    return existingPromise;
  }

  // Create a new promise for gathering git info
  const gitInfoPromise = gatherGitInfo();
  setGitInfoPromise(gitInfoPromise);

  try {
    const gitInfo = await gitInfoPromise;
    setCachedGitInfo(gitInfo);
    return gitInfo;
  } finally {
    // Clear the promise after completion
    setGitInfoPromise(null);
  }
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

/** Loads all data in a single command to avoid multiple executions. */
async function loadGitInfo(hasSecretToken: boolean) {
  const automated = isCI || hasSecretToken;

  // ensures multi line output on errors doesn't break the parsing
  const delimiter = randomUUID().repeat(2);

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
  ].join(` && echo ${delimiter} && `);

  try {
    const { stdout } = await exec(command);

    const [name, email, remoteOrigin, branch, commit, tagsOutput] = stdout
      .trim()
      .split(delimiter)
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
      data: { command, delimiter },
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
function parseGitUrl(remoteOrigin: string, stdout: string) {
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
    const { stdout: name } = await exec('git config --global user.name');
    const { stdout: email } = await exec('git config --global user.email');

    if (!name?.trim() || !email?.trim()) {
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message: 'Global git config incomplete',
      });
    }

    const { org, project } = await getAppNamingFromPackageJson(name.trim());

    const gitInfo: ZeGitInfo = {
      git: {
        name: name.trim(),
        email: email.trim(),
        branch: 'main',
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

/** Generate fallback git info when git is completely unavailable */
async function getFallbackGitInfo(): Promise<ZeGitInfo> {
  let tokenUserName: string | undefined;
  let tokenUserEmail: string | undefined;
  let tokenUserId: string | undefined;

  try {
    const token = await getToken();
    if (token && isTokenStillValid(token, 60)) {
      const decodedToken = jose.decodeJwt(token);

      tokenUserName = (decodedToken['https://api.zephyr-cloud.io/name'] ||
        decodedToken['name']) as string | undefined;

      tokenUserEmail = (decodedToken['https://api.zephyr-cloud.io/email'] ||
        decodedToken['email']) as string | undefined;

      tokenUserId = decodedToken['sub'] as string | undefined;

      if (tokenUserName || tokenUserEmail) {
        ze_log.git('Extracted user info from token for fallback:', {
          name: tokenUserName,
          email: tokenUserEmail,
        });
      }
    }
  } catch (error) {
    ze_log.git('Failed to extract token info for fallback:', error);
  }

  const gitName = tokenUserName || 'zephyr-deploy';
  const gitEmail = tokenUserEmail || 'deploy@zephyr-cloud.io';

  if (isCI) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message:
        'Git repository information is required in CI environments. Please ensure your CI workflow includes git repository with proper remote origin.',
    });
  }

  const { org, project } = await getAppNamingFromPackageJson(tokenUserName);

  const gitInfo: ZeGitInfo = {
    git: {
      name: gitName,
      email: gitEmail,
      branch: 'main',
      commit: `fallback-deployment-${Date.now()}`,
      tags: tokenUserId ? [`deployed-by:${tokenUserId}`] : [],
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
  const dirName = cwd.split('/').pop() || cwd.split('\\').pop() || 'untitled-project';
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

    // Use JWT username as org, fallback to 'personal'
    const org = tokenUserName ? sanitizeName(tokenUserName) : 'personal';

    if (packageName.includes('@')) {
      // Scoped package: @scope/name -> project: scope, app: name
      const [scope, name] = packageName.split('/');
      return {
        org,
        project: scope.replace('@', ''),
        app: name,
      };
    } else {
      // Monorepo: use root package name as project
      try {
        const rootPackageJson = await getPackageJson(process.cwd() + '/..');
        if (rootPackageJson) {
          return {
            org,
            project: rootPackageJson.name,
            app: packageName,
          };
        }
      } catch {
        // No root package.json found
      }

      // Single package: use same name for project and app
      return {
        org,
        project: packageName,
        app: packageName,
      };
    }
  } catch {
    // No package.json: use directory name
    const dirName = getCurrentDirectoryName();
    return {
      org: tokenUserName ? sanitizeName(tokenUserName) : 'personal',
      project: dirName,
      app: dirName,
    };
  }
}
