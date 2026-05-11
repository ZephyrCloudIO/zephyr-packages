import { readFile } from 'node:fs/promises';

type CiProvider = 'gitlab' | 'github';

interface CiTokenIdentity {
  provider: CiProvider;
  email?: string;
  emails?: string[];
  issuer?: string;
  providerSubject?: string;
  username?: string;
  source: 'jwt' | 'api' | 'env' | 'event' | 'noreply';
}

interface CiIdentityProvider {
  provider: CiProvider;
  detect(env: NodeJS.ProcessEnv): boolean;
  infer(env: NodeJS.ProcessEnv): Promise<CiTokenIdentity | undefined>;
}

type JwtPayload = Record<string, unknown>;

interface GitLabJobResponse {
  id?: number;
  web_url?: string;
  commit?: {
    author_email?: string | null;
  };
  pipeline?: {
    id?: number;
    project_id?: number;
  };
  user?: {
    id?: number | string | null;
    name?: string | null;
    username?: string | null;
    email?: string | null;
    public_email?: string | null;
    web_url?: string | null;
  };
}

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

const ciIdentityProviders: CiIdentityProvider[] = [
  {
    provider: 'gitlab',
    detect: isGitLabCi,
    infer: inferGitLabIdentity,
  },
  {
    provider: 'github',
    detect: isGitHubActions,
    infer: inferGitHubIdentity,
  },
];

export async function inferCiTokenIdentity(
  env: NodeJS.ProcessEnv = process.env
): Promise<CiTokenIdentity | undefined> {
  for (const provider of ciIdentityProviders) {
    if (!provider.detect(env)) {
      continue;
    }

    const identity = await provider.infer(env);
    if (identity) {
      return identity;
    }
  }

  return undefined;
}

function isGitLabCi(env: NodeJS.ProcessEnv): boolean {
  return env['GITLAB_CI'] === 'true' || env['CI_SERVER_NAME'] === 'GitLab';
}

function isGitHubActions(env: NodeJS.ProcessEnv): boolean {
  return env['GITHUB_ACTIONS'] === 'true';
}

async function inferGitLabIdentity(env: NodeJS.ProcessEnv): Promise<CiTokenIdentity | undefined> {
  const payload = decodeJwtPayload(env['CI_JOB_TOKEN']);
  const jwtEmails = getEmailClaims(payload, ['user_email', 'email']);

  if (payload && jwtEmails.length > 0 && gitLabClaimsMatchEnvironment(payload, env)) {
    return {
      provider: 'gitlab',
      email: jwtEmails[0],
      emails: jwtEmails,
      issuer: getGitLabIssuer(env),
      providerSubject: getStringClaim(payload, ['user_id', 'user_login', 'sub']),
      username: getStringClaim(payload, ['user_login', 'username']),
      source: 'jwt',
    };
  }

  const apiIdentity = await inferGitLabIdentityFromApi(env);
  if (apiIdentity) {
    return apiIdentity;
  }

  const envEmail = getEmail(env['GITLAB_USER_EMAIL']);
  if (envEmail) {
    return {
      provider: 'gitlab',
      email: envEmail,
      emails: [envEmail],
      issuer: getGitLabIssuer(env),
      providerSubject: env['GITLAB_USER_ID']?.trim(),
      username: env['GITLAB_USER_LOGIN']?.trim() || undefined,
      source: 'env',
    };
  }

  return undefined;
}

async function inferGitLabIdentityFromApi(env: NodeJS.ProcessEnv): Promise<CiTokenIdentity | undefined> {
  const apiUrl = getGitLabApiUrl(env);
  const jobToken = env['CI_JOB_TOKEN']?.trim();
  if (!apiUrl || !jobToken) {
    return undefined;
  }

  try {
    const job = await fetchGitLabJob(apiUrl, jobToken);
    if (!gitLabJobMatchesEnvironment(job, env)) {
      return undefined;
    }

    const emails = getEmails([job.user?.email, job.user?.public_email, job.commit?.author_email]);
    if (emails.length === 0) {
      return undefined;
    }

    return {
      provider: 'gitlab',
      email: emails[0],
      emails,
      issuer: getGitLabIssuer(env),
      providerSubject: stringifyId(job.user?.id) ?? env['GITLAB_USER_ID']?.trim(),
      username: job.user?.username?.trim() || undefined,
      source: 'api',
    };
  } catch {
    return undefined;
  }
}

function getGitLabIssuer(env: NodeJS.ProcessEnv): string | undefined {
  const serverUrl = env['CI_SERVER_URL']?.trim();
  if (serverUrl) {
    return serverUrl.replace(/\/+$/, '').toLowerCase();
  }

  const apiUrl = env['CI_API_V4_URL']?.trim();
  return apiUrl ? apiUrl.replace(/\/api\/v4\/?$/, '').replace(/\/+$/, '').toLowerCase() : undefined;
}

function getGitLabApiUrl(env: NodeJS.ProcessEnv): string | undefined {
  const apiUrl = env['CI_API_V4_URL']?.trim();
  if (apiUrl) {
    return apiUrl;
  }

  const serverUrl = env['CI_SERVER_URL']?.trim();
  return serverUrl ? `${serverUrl.replace(/\/$/, '')}/api/v4` : undefined;
}

async function fetchGitLabJob(apiUrl: string, jobToken: string): Promise<GitLabJobResponse> {
  const url = new URL('job', apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
  const response = await fetch(url.toString(), {
    headers: {
      'JOB-TOKEN': jobToken,
    },
  });

  if (!response.ok) {
    return {};
  }

  return (await response.json()) as GitLabJobResponse;
}

async function inferGitHubIdentity(env: NodeJS.ProcessEnv): Promise<CiTokenIdentity | undefined> {
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

async function readGitHubEventPayload(env: NodeJS.ProcessEnv): Promise<GitHubEventPayload | undefined> {
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

function getGitHubEventEmails(event: GitHubEventPayload | undefined, env: NodeJS.ProcessEnv): string[] {
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

  return actorId ? `${actorId}+${actor}@users.noreply.github.com` : `${actor}@users.noreply.github.com`;
}

function getGitHubActor(env: NodeJS.ProcessEnv, event: GitHubEventPayload | undefined): string | undefined {
  return env['GITHUB_TRIGGERING_ACTOR']?.trim() || env['GITHUB_ACTOR']?.trim() || event?.sender?.login?.trim();
}

function getGitHubActorId(env: NodeJS.ProcessEnv, event: GitHubEventPayload | undefined): string | undefined {
  return env['GITHUB_ACTOR_ID']?.trim() || stringifyId(event?.sender?.id);
}

function getGitHubIssuer(env: NodeJS.ProcessEnv): string {
  return (env['GITHUB_SERVER_URL']?.trim() || 'https://github.com').replace(/\/+$/, '').toLowerCase();
}

function stringifyId(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return String(value);
  }

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function decodeJwtPayload(token: string | undefined): JwtPayload | undefined {
  const payload = token?.split('.')[1];
  if (!payload) {
    return undefined;
  }

  try {
    return JSON.parse(Buffer.from(toBase64(payload), 'base64').toString('utf8')) as JwtPayload;
  } catch {
    return undefined;
  }
}

function toBase64(base64Url: string): string {
  const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
}

function getEmailClaims(payload: JwtPayload | undefined, keys: string[]): string[] {
  if (!payload) {
    return [];
  }

  return getEmails(keys.map((key) => payload[key]));
}

function getStringClaim(payload: JwtPayload | undefined, keys: string[]): string | undefined {
  if (!payload) {
    return undefined;
  }

  return keys
    .map((key) => stringifyId(payload[key]))
    .find((value): value is string => Boolean(value));
}

function getEmails(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => getEmail(value)).filter((email): email is string => Boolean(email))));
}

function getEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
}

function gitLabClaimsMatchEnvironment(payload: JwtPayload | undefined, env: NodeJS.ProcessEnv): boolean {
  if (!payload) {
    return false;
  }

  return (
    claimMatchesEnv(payload, 'job_id', env['CI_JOB_ID']) &&
    claimMatchesEnv(payload, 'project_id', env['CI_PROJECT_ID']) &&
    claimMatchesEnv(payload, 'pipeline_id', env['CI_PIPELINE_ID'])
  );
}

function gitLabJobMatchesEnvironment(job: GitLabJobResponse, env: NodeJS.ProcessEnv): boolean {
  return (
    claimMatchesEnv({ job_id: job.id }, 'job_id', env['CI_JOB_ID']) &&
    claimMatchesEnv({ project_id: job.pipeline?.project_id }, 'project_id', env['CI_PROJECT_ID']) &&
    claimMatchesEnv({ pipeline_id: job.pipeline?.id }, 'pipeline_id', env['CI_PIPELINE_ID'])
  );
}

function claimMatchesEnv(payload: JwtPayload, claim: string, expected: string | undefined): boolean {
  if (!expected || payload[claim] === undefined || payload[claim] === null) {
    return true;
  }

  return String(payload[claim]) === expected;
}
