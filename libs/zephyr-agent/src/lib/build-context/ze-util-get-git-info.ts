import isCI from 'is-ci';
import { exec as node_exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { logFn } from '../logging/ze-log-event';
import { hasSecretToken } from '../node-persist/secret-token';
import { getGitProviderInfo } from './git-provider-utils';

const exec = promisify(node_exec);

export interface ZeGitInfo {
  app: Pick<ZephyrPluginOptions['app'], 'org' | 'project'>;
  git: ZephyrPluginOptions['git'];
}

/** Loads the git information from the current repository. */
export async function getGitInfo(): Promise<ZeGitInfo> {
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
    logFn('warn', 'Git repository not found, falling back to global git config');
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

    const projectName = getCurrentDirectoryName();

    const gitInfo: ZeGitInfo = {
      git: {
        name: name.trim(),
        email: email.trim(),
        branch: 'main',
        commit: 'no-git-commit',
        tags: [],
      },
      app: {
        org: '', // Empty organization when git remote is not available
        project: projectName,
      },
    };

    ze_log.git('Using global git config (no local repository)', gitInfo);
    logFn(
      'warn',
      'Git repository not found. Organization will be determined from your account.'
    );
    ze_log.git('Organization will be determined from your account');
    logFn(
      'warn',
      'To use a specific organization, initialize a git repository: "git init && git remote add origin git@github.com:USERNAME_OR_ORG/YOUR_REPO.git"'
    );
    ze_log.git('To use a specific organization, initialize a git repository');

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
  // Generate defaults for anonymous users
  const defaultUser = 'anonymous';
  const defaultEmail = 'anonymous@zephyr-cloud.io';

  const projectName = getCurrentDirectoryName();

  const gitInfo: ZeGitInfo = {
    git: {
      name: defaultUser,
      email: defaultEmail,
      branch: 'main',
      commit: 'no-git-commit',
      tags: [],
    },
    app: {
      org: '', // Empty organization when git is not available
      project: projectName,
    },
  };

  ze_log.git('Using fallback git info (git not available)', gitInfo);
  logFn(
    'warn',
    `Git not available - organization will be determined from your account. Project: "${projectName}".`
  );
  ze_log.git(
    `Git not available - organization will be determined from your account. Project: "${projectName}".`
  );
  logFn(
    'warn',
    'To use a specific organization, initialize a git repository: "git init && git remote add origin git@github.com:USERNAME_OR_ORG/YOUR_REPO.git"'
  );
  ze_log.git('To use a specific organization, initialize a git repository');

  return gitInfo;
}

/** Get current directory name as project name */
function getCurrentDirectoryName(): string {
  const cwd = process.cwd();
  const dirName = cwd.split('/').pop() || cwd.split('\\').pop() || 'untitled-project';
  // Sanitize directory name for use as project name
  return dirName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}
