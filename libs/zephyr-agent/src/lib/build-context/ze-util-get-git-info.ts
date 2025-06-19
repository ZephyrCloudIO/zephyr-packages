import isCI from 'is-ci';
import { exec as node_exec } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { arch, homedir, hostname, platform } from 'node:os';
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
  } catch {
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

    // Generate org based on user email to ensure consistency
    const orgName = generateOrgFromEmail(email.trim());
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
        org: orgName,
        project: projectName,
      },
    };

    ze_log.git('Using global git config (no local repository)', gitInfo);
    logFn('warn', `Using auto-generated org "${orgName}" based on global git email`);
    ze_log.git(`Using auto-generated org "${orgName}" based on global git email`);
    logFn(
      'warn',
      'To use your own organization, initialize a git repository: "git init && git remote add origin git@github.com:USERNAME_OR_ORG/YOUR_REPO.git"'
    );
    ze_log.git('To use your own organization, initialize a git repository');

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

  // Generate a unique org name for anonymous users using machine-specific data
  const uniqueId = generateUniqueOrgId();
  const orgName = `anonymous-${uniqueId}`;
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
      org: orgName,
      project: projectName,
    },
  };

  ze_log.git('Using fallback git info (git not available)', gitInfo);
  logFn(
    'warn',
    `Git not available - using fallback org "${orgName}" and project "${projectName}"`
  );
  ze_log.git(
    `Git not available - using fallback org "${orgName}" and project "${projectName}"`
  );
  logFn(
    'warn',
    'To use your own organization, initialize a git repository: "git init && git remote add origin git@github.com:USERNAME_OR_ORG/YOUR_REPO.git"'
  );
  ze_log.git('To use your own organization, initialize a git repository');

  return gitInfo;
}

/** Generate a consistent org name from email */
function generateOrgFromEmail(email: string): string {
  // Create a hash of the email to ensure consistency
  const hash = createHash('sha256').update(email.toLowerCase()).digest('hex');
  // Take first 8 chars of hash for readability
  const shortHash = hash.substring(0, 8);
  // Extract username part of email
  const username = email.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '-');
  // Combine for a unique but readable org name
  return `${username}-${shortHash}`;
}

/** Get current directory name as project name */
function getCurrentDirectoryName(): string {
  const cwd = process.cwd();
  const dirName = cwd.split('/').pop() || cwd.split('\\').pop() || 'untitled-project';
  // Sanitize directory name for use as project name
  return dirName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

/** Generate a unique org ID for anonymous users */
function generateUniqueOrgId(): string {
  // Use a combination of machine-specific data to create a consistent but unique ID per machine
  const machineData = [
    hostname(), // Machine hostname
    homedir(), // Home directory path
    platform(), // OS platform
    arch(), // CPU architecture
  ].join(':');

  // Create a hash of the machine data
  const hash = createHash('sha256').update(machineData).digest('hex');
  // Return first 8 chars for readability
  return hash.substring(0, 8);
}
