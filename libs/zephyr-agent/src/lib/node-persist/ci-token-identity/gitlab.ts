import type { CiIdentityProvider, CiTokenIdentity } from './types';
import {
  claimMatchesEnv,
  decodeJwtPayload,
  getEmail,
  getEmailClaims,
  getEmails,
  getStringClaim,
  stringifyId,
  type JwtPayload,
} from './utils';

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

const GITLAB_JOB_FETCH_TIMEOUT_MS = 10_000;

export const gitLabCiIdentityProvider: CiIdentityProvider = {
  provider: 'gitlab',
  detect: isGitLabCi,
  infer: inferGitLabIdentity,
};

function isGitLabCi(env: NodeJS.ProcessEnv): boolean {
  return env['GITLAB_CI'] === 'true' || env['CI_SERVER_NAME'] === 'GitLab';
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
    signal: AbortSignal.timeout(GITLAB_JOB_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    return {};
  }

  return (await response.json()) as GitLabJobResponse;
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
