import isCI from 'is-ci';
import { exec as node_exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { logFn } from '../logging/ze-log-event';
import { hasSecretToken } from '../node-persist/secret-token';
import { getToken } from '../node-persist/token';
import { isTokenStillValid } from '../auth/login';
import * as jose from 'jose';
import { getGitProviderInfo } from './git-provider-utils';
import { isInteractiveTerminal, promptForGitInfo } from './ze-util-interactive-prompts';
import {
  getCachedGitInfo,
  setCachedGitInfo,
  getGitInfoPromise,
  setGitInfoPromise,
} from './ze-git-info-cache';

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

    const projectName = getCurrentDirectoryName();
    let org = '';
    let project = projectName;

    // If we're in an interactive terminal, prompt for org and project info
    if (isInteractiveTerminal()) {
      logFn(
        'error',
        '⚠️  Git repository not found. Zephyr REQUIRES a git repository with remote origin.'
      );
      const promptResult = await promptForGitInfo(projectName);
      org = promptResult.org;
      project = promptResult.project;
    } else {
      // Non-interactive mode: use defaults and show warnings
      logFn(
        'error',
        '⚠️  WARNING: Git repository not found. Zephyr REQUIRES git for proper deployment.'
      );
      logFn(
        'error',
        'Organization will be determined from your account - this is NOT recommended.'
      );
      ze_log.git('Organization will be determined from your account');
      logFn(
        'warn',
        'To properly use Zephyr: git init && git remote add origin git@github.com:ORG/REPO.git'
      );
      logFn('info', 'Full setup guide: https://docs.zephyr-cloud.io');
    }

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

/** Try to get git info using environment variables for AI tools/platforms */
async function getEnvBasedGitInfo(): Promise<ZeGitInfo | null> {
  try {
    // Check if we have the required environment variables
    const org = process.env['ZEPHYR_ORG'];
    const project = process.env['ZEPHYR_PROJECT'];

    if (!org || !project) {
      return null;
    }

    // Check if we have a valid token (required for authentication)
    const token = await getToken();
    if (!token || !isTokenStillValid(token, 60)) {
      ze_log.git('Environment variables found but no valid token for authentication');
      return null;
    }

    ze_log.git('Using environment variable fallback for deployment');
    logFn('info', '🔧 Using ZEPHYR_ORG and ZEPHYR_PROJECT environment variables');

    // Try to extract user information from the JWT token
    let tokenUserName: string | undefined;
    let tokenUserEmail: string | undefined;
    let tokenUserId: string | undefined;

    try {
      const decodedToken = jose.decodeJwt(token);
      ze_log.git('Decoded JWT token claims:', Object.keys(decodedToken));

      // Zephyr uses both standard and namespaced claims
      // Priority: namespaced claims > standard claims > other common claims
      tokenUserName = (decodedToken['https://api.zephyr-cloud.io/name'] ||
        decodedToken['name'] ||
        decodedToken['nickname'] ||
        decodedToken['preferred_username'] ||
        decodedToken['given_name']) as string | undefined;

      tokenUserEmail = (decodedToken['https://api.zephyr-cloud.io/email'] ||
        decodedToken['email'] ||
        decodedToken['upn'] || // User Principal Name in some systems
        decodedToken['unique_name']) as string | undefined;

      // Extract user ID from 'sub' claim (e.g., "google-oauth2|109373569979745840525")
      tokenUserId = decodedToken['sub'] as string | undefined;

      if (tokenUserName || tokenUserEmail) {
        ze_log.git('Extracted user info from token:', {
          name: tokenUserName,
          email: tokenUserEmail,
          userId: tokenUserId,
        });
      }
    } catch (error) {
      ze_log.git('Failed to decode JWT token for user info:', error);
    }

    // Use provided values or token-extracted values or defaults
    const gitName =
      process.env['ZEPHYR_GIT_NAME'] || tokenUserName || 'zephyr-env-deploy';
    const gitEmail =
      process.env['ZEPHYR_GIT_EMAIL'] || tokenUserEmail || 'deploy@zephyr-cloud.io';
    const branch = process.env['ZEPHYR_GIT_BRANCH'] || 'main';

    const gitInfo: ZeGitInfo = {
      git: {
        name: gitName,
        email: gitEmail,
        branch,
        commit: `env-deployment-${Date.now()}`,
        tags: tokenUserId ? [`deployed-by:${tokenUserId}`] : [],
      },
      app: {
        org,
        project,
      },
    };

    ze_log.git('Using environment-based git info', gitInfo);
    logFn('info', `Organization: ${org}, Project: ${project}`);
    logFn('info', `Deployment by: ${gitName} <${gitEmail}>`);

    if (tokenUserName || tokenUserEmail) {
      logFn('info', '✓ User information extracted from authentication token');
    }

    return gitInfo;
  } catch (error) {
    ze_log.git('Failed to use environment-based fallback:', error);
    return null;
  }
}

/** Generate fallback git info when git is completely unavailable */
async function getFallbackGitInfo(): Promise<ZeGitInfo> {
  // First try environment-based fallback for AI tools/platforms
  const envBasedInfo = await getEnvBasedGitInfo();
  if (envBasedInfo) {
    return envBasedInfo;
  }

  // Try to extract user info from token even without env vars
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

  // Use token info if available, otherwise use generic defaults
  const gitName = tokenUserName || 'zephyr-deploy';
  const gitEmail = tokenUserEmail || 'deploy@zephyr-cloud.io';

  const projectName = getCurrentDirectoryName();
  let org = '';
  let project = projectName;

  // If we're in an interactive terminal, prompt for org and project info
  if (isInteractiveTerminal()) {
    logFn('error', '⚠️  Git not available. Zephyr REQUIRES git for deployment.');
    const promptResult = await promptForGitInfo(projectName);
    org = promptResult.org;
    project = promptResult.project;
  } else {
    // In CI environments, we should fail if git is not available
    if (isCI) {
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message:
          'Git repository information is required in CI environments. Please ensure your CI workflow includes git repository with proper remote origin.',
      });
    }

    // Non-interactive, non-CI mode: use defaults and show warnings
    logFn(
      'error',
      `⚠️  CRITICAL: Git not available. Zephyr CANNOT function properly without git.`
    );
    logFn(
      'error',
      `Using fallback project name: "${projectName}" - deployment may have issues.`
    );

    if (tokenUserName || tokenUserEmail) {
      logFn('info', `Deploying as: ${gitName} <${gitEmail}>`);
    }

    ze_log.git(`Git not available - using fallback configuration`);
    logFn(
      'warn',
      'Zephyr REQUIRES: git init && git remote add origin git@github.com:ORG/REPO.git && git commit'
    );
    logFn('info', 'Setup guide: https://docs.zephyr-cloud.io');
  }

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

/** Get current directory name as project name */
function getCurrentDirectoryName(): string {
  const cwd = process.cwd();
  const dirName = cwd.split('/').pop() || cwd.split('\\').pop() || 'untitled-project';
  // Sanitize directory name for use as project name
  return dirName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}
