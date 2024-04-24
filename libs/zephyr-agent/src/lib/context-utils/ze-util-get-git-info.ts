import { execSync } from 'node:child_process';
import { ConfigurationError } from '../custom-errors/configuration-error';

export interface GitInfo {
  git: {
    name: string;
    email: string;
    branch: string;
    commit: string;
  };
  app: {
    org: string | undefined;
    project: string | undefined;
  };
}

export function getGitInfo(): GitInfo | void {
  try {
    const username = execSync('git config user.name').toString().trim();
    const email = execSync('git config user.email').toString().trim();
    const remoteOrigin = execSync('git config --get remote.origin.url')
      .toString()
      .trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD')
      .toString()
      .trim();
    const commitHash = execSync('git rev-parse HEAD').toString().trim();

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
        ? urlParts[urlParts.length - 2]
        : undefined;
    const repositoryName =
      urlParts && urlParts.length > 0
        ? urlParts[urlParts.length - 1]
        : undefined;

    return {
      git: {
        name: username,
        email,
        branch,
        commit: commitHash,
      },
      app: {
        org: organization?.toLowerCase(),
        project: repositoryName?.toLowerCase(),
      },
    };
  } catch (error) {
    throw new ConfigurationError(`git is not configured properly \n
    - please set git user.name and user.email \n
    - please set valid 'git remote origin' \n
    `);
  }
}
