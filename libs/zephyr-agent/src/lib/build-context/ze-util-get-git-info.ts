import gitUrlParse from 'git-url-parse';
import isCI from 'is-ci';
import cp from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { type ZephyrPluginOptions } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { hasSecretToken } from '../node-persist/secret-token';

const exec = promisify(cp.exec);

export interface ZeGitInfo {
  app: Pick<ZephyrPluginOptions['app'], 'org' | 'project'>;
  git: ZephyrPluginOptions['git'];
}

/** Loads the git information from the current repository. */
export async function getGitInfo(): Promise<ZeGitInfo> {
  const hasToken = hasSecretToken();

  const { name, email, remoteOrigin, branch, commit, stdout } =
    await loadGitInfo(hasToken);

  if (!hasToken && (!name || !email)) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_USERNAME_EMAIL, {
      data: { stdout },
    });
  }

  const app = parseGitUrl(remoteOrigin, stdout);

  const gitInfo = {
    git: { name, email, branch, commit },
    app,
  };

  ze_log('Loaded: git info', gitInfo);

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
  ].join(` && echo ${delimiter} && `);

  try {
    const { stdout } = await exec(command);

    const [name, email, remoteOrigin, branch, commit] = stdout
      .trim()
      .split(delimiter)
      .map((x) => x.trim());

    return {
      name,
      email,
      remoteOrigin,
      branch,
      commit,
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
 * This package differentiate CI providers and handle a lot of small utilities for getting
 * git info from `azure`, `aws` etc
 */
function parseGitUrl(remoteOrigin: string, stdout: string) {
  if (!remoteOrigin) {
    throw new ZephyrError(ZeErrors.ERR_GIT_REMOTE_ORIGIN, {
      data: { stdout },
    });
  }

  let parsed: gitUrlParse.GitUrl;

  try {
    parsed = gitUrlParse(remoteOrigin);
  } catch (cause) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message: stdout,
      cause,
      data: { stdout },
    });
  }

  if (!parsed.owner || !parsed.name) {
    throw new ZephyrError(ZeErrors.ERR_GIT_REMOTE_ORIGIN, {
      data: { stdout },
    });
  }

  return {
    org: parsed.owner.toLocaleLowerCase(),
    project: parsed.name.toLocaleLowerCase(),
  };
}
