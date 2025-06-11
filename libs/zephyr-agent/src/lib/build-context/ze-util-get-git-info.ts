import isCI from 'is-ci';
import { exec as node_exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { hasSecretToken } from '../node-persist/secret-token';
import { getGitProviderInfo } from './git-provider-utils';

const exec = promisify(node_exec);

export interface ZeGitInfo {
  app: Pick<ZephyrPluginOptions['app'], 'org' | 'project'>;
  git: ZephyrPluginOptions['git'];
}

/** Loads the git information from the current repository. */
export async function getGitInfo(): Promise<ZeGitInfo> {
  ze_log.init('Initializing: git info...');
  const hasToken = hasSecretToken();

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
