import { inferCiTokenIdentity } from './ci-token-identity';

function jwt(payload: Record<string, unknown>): string {
  return [
    Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature',
  ].join('.');
}

describe('inferCiTokenIdentity', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('infers GitLab actor email from CI_JOB_TOKEN JWT claims', async () => {
    const identity = await inferCiTokenIdentity({
      GITLAB_CI: 'true',
      CI_JOB_TOKEN: jwt({
        user_email: 'builder@example.com',
        job_id: 123,
        project_id: 456,
        pipeline_id: 789,
      }),
      CI_JOB_ID: '123',
      CI_PROJECT_ID: '456',
      CI_PIPELINE_ID: '789',
    });

    expect(identity).toEqual({
      provider: 'gitlab',
      email: 'builder@example.com',
      source: 'jwt',
    });
  });

  it('falls back to GitLab job API for legacy/non-email job tokens', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 123,
          pipeline: {
            id: 789,
            project_id: 456,
          },
          user: {
            email: 'builder@example.com',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as typeof fetch;

    const identity = await inferCiTokenIdentity({
      GITLAB_CI: 'true',
      CI_API_V4_URL: 'https://gitlab.example.com/api/v4',
      CI_JOB_TOKEN: 'legacy-token',
      CI_JOB_ID: '123',
      CI_PROJECT_ID: '456',
      CI_PIPELINE_ID: '789',
    });

    expect(identity).toEqual({
      provider: 'gitlab',
      email: 'builder@example.com',
      source: 'api',
    });
    expect(global.fetch).toHaveBeenCalledWith('https://gitlab.example.com/api/v4/job', {
      headers: {
        'JOB-TOKEN': 'legacy-token',
      },
    });
  });

  it('ignores GitLab API jobs that do not match the current job environment', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 999,
          user: {
            email: 'builder@example.com',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as typeof fetch;

    const identity = await inferCiTokenIdentity({
      GITLAB_CI: 'true',
      CI_API_V4_URL: 'https://gitlab.example.com/api/v4',
      CI_JOB_TOKEN: 'legacy-token',
      CI_JOB_ID: '123',
    });

    expect(identity).toBeUndefined();
  });

  it('falls back to GitLab predefined actor email for unavailable job identity', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 404 })) as typeof fetch;

    const identity = await inferCiTokenIdentity({
      GITLAB_CI: 'true',
      CI_JOB_TOKEN: 'legacy-token',
      GITLAB_USER_EMAIL: 'builder@example.com',
    });

    expect(identity).toEqual({
      provider: 'gitlab',
      email: 'builder@example.com',
      source: 'env',
    });
  });
});
