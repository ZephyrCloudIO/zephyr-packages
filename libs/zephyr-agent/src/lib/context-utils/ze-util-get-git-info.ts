import { promisify } from 'node:util';
import { exec as execCB } from 'node:child_process';
import isCI from 'is-ci';
import { ze_log, _fs_cache, getSecretToken } from 'zephyr-edge-contract';

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

  const [username, email, remoteOrigin, branch, commitHash] = await Promise.all(
    [
      getGitUsername(),
      getGitEmail(),
      getGitRemoteOrigin(),
      getGitBranch(),
      getGitCommitHash(),
    ]
  );

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

  const has_secret_token = await hasSecretToken();
  if (!has_secret_token && (!username || !email)) {
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

async function hasSecretToken() {
  return getSecretToken().then((res) => !!res);
}

async function getGitUsername() {
  const has_secret_token = await hasSecretToken();
  if (isCI || has_secret_token) {
    return exec("git log -1 --pretty=format:'%an'").then((res) =>
      res.stdout.trim()
    );
  }
  return exec('git config user.name').then((res) => res.stdout.trim());
}

async function getGitEmail() {
  const has_secret_token = await hasSecretToken();
  if (isCI || has_secret_token) {
    return exec("git log -1 --pretty=format:'%ae'").then((res) =>
      res.stdout.trim()
    );
  }
  return exec('git config user.email').then((res) => res.stdout.trim());
}

async function getGitRemoteOrigin() {
  return exec('git config --get remote.origin.url').then((res) =>
    res.stdout.trim()
  );
}

async function getGitBranch() {
  return exec('git rev-parse --abbrev-ref HEAD').then((res) =>
    res.stdout.trim()
  );
}

async function getGitCommitHash() {
  return exec('git rev-parse HEAD').then((res) => res.stdout.trim());
}
