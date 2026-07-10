import { readFile } from 'node:fs/promises';
import type { CiIdentityProvider, CiTokenIdentity } from './types';
import { getEmails, stringifyId } from './utils';

interface GitHubCommitUser {
  email?: string | null;
}

interface GitHubCommit {
  id?: string | null;
  author?: GitHubCommitUser | null;
  committer?: GitHubCommitUser | null;
}

interface GitHubEventPayload {
  after?: string | null;
  sender?: {
    id?: number | string | null;
    login?: string | null;
  } | null;
  pusher?: {
    email?: string | null;
  } | null;
  head_commit?: GitHubCommit | null;
  commits?: GitHubCommit[] | null;
}

export const gitHubCiIdentityProvider: CiIdentityProvider = {
  provider: 'github',
  detect: isGitHubActions,
  infer: inferGitHubIdentity,
};

function isGitHubActions(env: NodeJS.ProcessEnv): boolean {
  return env['GITHUB_ACTIONS'] === 'true';
}

async function inferGitHubIdentity(
  env: NodeJS.ProcessEnv
): Promise<CiTokenIdentity | undefined> {
  const event = await readGitHubEventPayload(env);
  const eventEmails = getGitHubEventEmails(event, env);
  const noreplyEmail = getGitHubNoreplyEmail(env, event);
  const emails = getEmails([...eventEmails, noreplyEmail]);
  const providerSubject = getGitHubActorId(env, event);
  const username = getGitHubActor(env, event);

  if (eventEmails.length > 0 || providerSubject) {
    return {
      provider: 'github',
      email: emails[0],
      emails,
      issuer: getGitHubIssuer(env),
      providerSubject,
      username,
      source: eventEmails.length > 0 ? 'event' : 'noreply',
    };
  }

  if (noreplyEmail) {
    return {
      provider: 'github',
      email: noreplyEmail,
      emails: [noreplyEmail],
      issuer: getGitHubIssuer(env),
      providerSubject,
      username,
      source: 'noreply',
    };
  }

  return undefined;
}

async function readGitHubEventPayload(
  env: NodeJS.ProcessEnv
): Promise<GitHubEventPayload | undefined> {
  const eventPath = env['GITHUB_EVENT_PATH']?.trim();
  if (!eventPath) {
    return undefined;
  }

  try {
    return JSON.parse(await readFile(eventPath, 'utf8')) as GitHubEventPayload;
  } catch {
    return undefined;
  }
}

function getGitHubEventEmails(
  event: GitHubEventPayload | undefined,
  env: NodeJS.ProcessEnv
): string[] {
  if (!event) {
    return [];
  }

  const matchingCommit = getGitHubMatchingCommit(event, env);
  return getEmails([
    matchingCommit?.author?.email,
    matchingCommit?.committer?.email,
    event.head_commit?.author?.email,
    event.head_commit?.committer?.email,
    event.pusher?.email,
  ]);
}

function getGitHubMatchingCommit(
  event: GitHubEventPayload,
  env: NodeJS.ProcessEnv
): GitHubCommit | undefined {
  const sha = env['GITHUB_SHA']?.trim();
  if (!sha) {
    return undefined;
  }

  if (event.head_commit?.id === sha) {
    return event.head_commit;
  }

  return event.commits?.find((commit) => commit.id === sha);
}

function getGitHubNoreplyEmail(
  env: NodeJS.ProcessEnv,
  event: GitHubEventPayload | undefined
): string | undefined {
  const actor = getGitHubActor(env, event);
  const actorId = getGitHubActorId(env, event);

  if (!actor) {
    return undefined;
  }

  return actorId
    ? `${actorId}+${actor}@users.noreply.github.com`
    : `${actor}@users.noreply.github.com`;
}

function getGitHubActor(
  env: NodeJS.ProcessEnv,
  event: GitHubEventPayload | undefined
): string | undefined {
  return (
    env['GITHUB_TRIGGERING_ACTOR']?.trim() ||
    env['GITHUB_ACTOR']?.trim() ||
    event?.sender?.login?.trim()
  );
}

function getGitHubActorId(
  env: NodeJS.ProcessEnv,
  event: GitHubEventPayload | undefined
): string | undefined {
  return env['GITHUB_ACTOR_ID']?.trim() || stringifyId(event?.sender?.id);
}

function getGitHubIssuer(env: NodeJS.ProcessEnv): string {
  return (env['GITHUB_SERVER_URL']?.trim() || 'https://github.com')
    .replace(/\/+$/, '')
    .toLowerCase();
}
