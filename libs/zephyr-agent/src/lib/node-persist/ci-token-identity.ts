type CiProvider = 'gitlab';

interface CiTokenIdentity {
  provider: CiProvider;
  email: string;
  source: 'jwt' | 'api' | 'env';
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
    name?: string | null;
    username?: string | null;
    email?: string | null;
    public_email?: string | null;
    web_url?: string | null;
  };
}

const ciIdentityProviders: CiIdentityProvider[] = [
  {
    provider: 'gitlab',
    detect: isGitLabCi,
    infer: inferGitLabIdentity,
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

async function inferGitLabIdentity(env: NodeJS.ProcessEnv): Promise<CiTokenIdentity | undefined> {
  const payload = decodeJwtPayload(env['CI_JOB_TOKEN']);
  const jwtEmail = getEmailClaim(payload, ['user_email', 'email']);

  if (payload && jwtEmail && gitLabClaimsMatchEnvironment(payload, env)) {
    return {
      provider: 'gitlab',
      email: jwtEmail,
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

    const email = getEmail(job.user?.email) ?? getEmail(job.user?.public_email) ?? getEmail(job.commit?.author_email);
    if (!email) {
      return undefined;
    }

    return {
      provider: 'gitlab',
      email,
      source: 'api',
    };
  } catch {
    return undefined;
  }
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

function getEmailClaim(payload: JwtPayload | undefined, keys: string[]): string | undefined {
  if (!payload) {
    return undefined;
  }

  for (const key of keys) {
    const email = getEmail(payload[key]);
    if (email) {
      return email;
    }
  }

  return undefined;
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
