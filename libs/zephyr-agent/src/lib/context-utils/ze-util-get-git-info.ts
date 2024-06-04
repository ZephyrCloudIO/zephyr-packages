import { promisify } from 'node:util';
import { exec as execCB } from 'node:child_process';
import { ze_log, _fs_cache } from 'zephyr-edge-contract';

import { ze_user_token } from './ze-user-token';
import { GitRemoteConfigurationError } from '../custom-errors/git-remote-configuration-error';
import { GitUserIdentityError } from '../custom-errors/git-user-identity-error';

const exec = promisify(execCB);
const cache_prefix = 'git_info';

export interface GitInfo {
  git: {
    name?: string;
    email?: string;
    branch: string;
    commit: string;
  };
  app: {
    org: string;
    project: string;
  };
}

export async function getGitInfo(): Promise<GitInfo> {
  const cache_key = `${cache_prefix}:${process.cwd()}`;
  const cached = await _fs_cache.getCache(cache_key);
  if (cached) return JSON.parse(cached);

  const [username, email, remoteOrigin, branch, commitHash] = await Promise.all([
    exec('git config user.name').then((res) => res.stdout.trim()),
    exec('git config user.email').then((res) => res.stdout.trim()),
    exec('git config --get remote.origin.url').then((res) => res.stdout.trim()),
    exec('git rev-parse --abbrev-ref HEAD').then((res) => res.stdout.trim()),
    exec('git rev-parse HEAD').then((res) => res.stdout.trim()),
  ]);

  // parse remote origin url to get the organization and repository name
  const urlParts = remoteOrigin
    // Remove the protocol (like https://) and user info
    .replace(/.+@/, '')
    // Remove the .git at the end
    .replace(/.git$/, '')
    // Split at the colon to separate domain from path
    .split(':')
    // Take the last part, which is the path
    .pop()
    // Split the path into parts
    ?.split('/');

  const organization =
    urlParts && urlParts?.length > 1
      ? urlParts[urlParts.length - 2]?.toLocaleLowerCase()
      : undefined;
  const repositoryName =
    urlParts && urlParts.length > 0
      ? urlParts[urlParts.length - 1]?.toLocaleLowerCase()
      : undefined;

  if (!organization || !repositoryName) {
    throw new GitRemoteConfigurationError();
  }

  if (!ze_user_token && (!username || !email)) {
    throw new GitUserIdentityError();
  }

  const gitInfo = {
    git: {
      name: username,
      email,
      branch,
      commit: commitHash,
    },
    app: {
      org: organization,
      project: repositoryName,
    },
  };
  ze_log('Git Info Loaded', gitInfo);
  await _fs_cache.saveCache(cache_key, JSON.stringify(gitInfo));
  return gitInfo;
}
