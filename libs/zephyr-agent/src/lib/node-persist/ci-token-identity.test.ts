import { afterEach, describe, expect, it, rs } from '@rstest/core';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  let tempDirs: string[] = [];

  afterEach(async () => {
    global.fetch = originalFetch;
    const dirs = tempDirs;
    tempDirs = [];
    await Promise.all(dirs.map((dir) => rm(dir, { force: true, recursive: true })));
  });

  it('infers GitLab actor email from CI_JOB_TOKEN JWT claims', async () => {
    const identity = await inferCiTokenIdentity({
      GITLAB_CI: 'true',
      CI_SERVER_URL: 'https://gitlab.example.com',
      CI_JOB_TOKEN: jwt({
        user_email: 'builder@example.com',
        user_id: 42,
        user_login: 'builder',
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
      emails: ['builder@example.com'],
      issuer: 'https://gitlab.example.com',
      providerSubject: '42',
      username: 'builder',
      source: 'jwt',
    });
  });

  it('falls back to GitLab job API for legacy/non-email job tokens', async () => {
    global.fetch = rs.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 123,
          pipeline: {
            id: 789,
            project_id: 456,
          },
          user: {
            id: 42,
            username: 'builder',
            email: 'builder@example.com',
            public_email: 'public-builder@example.com',
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
      emails: ['builder@example.com', 'public-builder@example.com'],
      issuer: 'https://gitlab.example.com',
      providerSubject: '42',
      username: 'builder',
      source: 'api',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://gitlab.example.com/api/v4/job',
      expect.objectContaining({
        headers: {
          'JOB-TOKEN': 'legacy-token',
        },
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('ignores GitLab API jobs that do not match the current job environment', async () => {
    global.fetch = rs.fn().mockResolvedValue(
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
    global.fetch = rs
      .fn()
      .mockResolvedValue(new Response('{}', { status: 404 })) as typeof fetch;

    const identity = await inferCiTokenIdentity({
      GITLAB_CI: 'true',
      CI_SERVER_URL: 'https://gitlab.example.com',
      CI_JOB_TOKEN: 'legacy-token',
      GITLAB_USER_EMAIL: 'builder@example.com',
      GITLAB_USER_ID: '42',
      GITLAB_USER_LOGIN: 'builder',
    });

    expect(identity).toEqual({
      provider: 'gitlab',
      email: 'builder@example.com',
      emails: ['builder@example.com'],
      issuer: 'https://gitlab.example.com',
      providerSubject: '42',
      username: 'builder',
      source: 'env',
    });
  });

  it('infers GitHub Actions actor email from the matching event commit', async () => {
    const eventPath = await writeGitHubEvent({
      pusher: {
        email: 'pusher@example.com',
      },
      head_commit: {
        id: 'abc123',
        author: {
          email: 'author@example.com',
        },
        committer: {
          email: 'committer@example.com',
        },
      },
    });

    const identity = await inferCiTokenIdentity({
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_SHA: 'abc123',
      GITHUB_ACTOR: 'octocat',
      GITHUB_ACTOR_ID: '12345',
    });

    expect(identity).toEqual({
      provider: 'github',
      email: 'author@example.com',
      emails: [
        'author@example.com',
        'committer@example.com',
        'pusher@example.com',
        '12345+octocat@users.noreply.github.com',
      ],
      issuer: 'https://github.com',
      providerSubject: '12345',
      username: 'octocat',
      source: 'event',
    });
  });

  it('falls back to GitHub pusher email from the event payload', async () => {
    const eventPath = await writeGitHubEvent({
      pusher: {
        email: 'pusher@example.com',
      },
    });

    const identity = await inferCiTokenIdentity({
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_SHA: 'abc123',
      GITHUB_ACTOR: 'octocat',
      GITHUB_ACTOR_ID: '12345',
    });

    expect(identity).toEqual({
      provider: 'github',
      email: 'pusher@example.com',
      emails: ['pusher@example.com', '12345+octocat@users.noreply.github.com'],
      issuer: 'https://github.com',
      providerSubject: '12345',
      username: 'octocat',
      source: 'event',
    });
  });

  it('falls back to GitHub noreply email when the event has no actor email', async () => {
    const eventPath = await writeGitHubEvent({
      sender: {
        id: 12345,
        login: 'octocat',
      },
    });

    const identity = await inferCiTokenIdentity({
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_ACTOR: 'octocat',
      GITHUB_ACTOR_ID: '12345',
    });

    expect(identity).toEqual({
      provider: 'github',
      email: '12345+octocat@users.noreply.github.com',
      emails: ['12345+octocat@users.noreply.github.com'],
      issuer: 'https://github.com',
      providerSubject: '12345',
      username: 'octocat',
      source: 'noreply',
    });
  });

  it('reports a GitHub bot when the event sender matches the workflow actor', async () => {
    const eventPath = await writeGitHubEvent({
      sender: {
        id: 29139614,
        login: 'renovate[bot]',
        type: 'Bot',
      },
    });

    const identity = await inferCiTokenIdentity({
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_ACTOR: 'renovate[bot]',
      GITHUB_ACTOR_ID: '29139614',
    });

    expect(identity).toEqual({
      provider: 'github',
      email: '29139614+renovate[bot]@users.noreply.github.com',
      emails: ['29139614+renovate[bot]@users.noreply.github.com'],
      issuer: 'https://github.com',
      providerSubject: '29139614',
      username: 'renovate[bot]',
      providerActorType: 'bot',
      source: 'noreply',
    });
  });

  it('ignores sender type when the sender does not match the workflow actor', async () => {
    const eventPath = await writeGitHubEvent({
      sender: {
        id: 29139614,
        login: 'renovate[bot]',
        type: 'Bot',
      },
    });

    const identity = await inferCiTokenIdentity({
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_ACTOR: 'octocat',
      GITHUB_ACTOR_ID: '12345',
    });

    expect(identity?.providerActorType).toBeUndefined();
    expect(identity?.providerSubject).toBe('12345');
    expect(identity?.username).toBe('octocat');
  });

  it('keeps the GitHub actor login aligned with the stable actor ID on reruns', async () => {
    const eventPath = await writeGitHubEvent({});

    const identity = await inferCiTokenIdentity({
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_ACTOR: 'original-actor',
      GITHUB_ACTOR_ID: '12345',
      GITHUB_TRIGGERING_ACTOR: 'rerun-actor',
    });

    expect(identity).toEqual({
      provider: 'github',
      email: '12345+original-actor@users.noreply.github.com',
      emails: ['12345+original-actor@users.noreply.github.com'],
      issuer: 'https://github.com',
      providerSubject: '12345',
      username: 'original-actor',
      source: 'noreply',
    });
  });

  it('infers EAS actor emails from the built commit', async () => {
    const { dir, commit } = await createGitRepo('author@example.com');

    const identity = await inferCiTokenIdentity({
      EAS_BUILD: 'true',
      EAS_BUILD_USERNAME: 'expo-dev',
      EAS_BUILD_WORKINGDIR: dir,
      EAS_BUILD_GIT_COMMIT_HASH: commit,
    });

    expect(identity).toEqual({
      provider: 'eas',
      email: 'author@example.com',
      emails: ['author@example.com', 'committer@example.com'],
      username: 'expo-dev',
      source: 'git',
    });
  });

  it('ignores the deprecated ZE_USER_EMAIL on EAS', async () => {
    const dir = await createTempDir('zephyr-eas-no-git-');

    const identity = await inferCiTokenIdentity({
      EAS_BUILD: 'true',
      EAS_BUILD_USERNAME: 'expo-dev',
      EAS_BUILD_WORKINGDIR: dir,
      ZE_USER_EMAIL: 'member@example.com',
    });

    expect(identity?.emails).toBeUndefined();
    expect(identity?.providerActorType).toBe('bot');
  });

  it('reports the EAS user as a bot when no email is available', async () => {
    const dir = await createTempDir('zephyr-eas-no-git-');

    const identity = await inferCiTokenIdentity({
      EAS_BUILD: 'true',
      EAS_BUILD_USERNAME: 'expo-dev',
      EAS_BUILD_PROJECT_ID: 'project-id',
      EAS_BUILD_WORKINGDIR: dir,
    });

    expect(identity).toEqual({
      provider: 'eas',
      issuer: 'https://expo.dev',
      providerSubject: 'expo-dev',
      username: 'expo-dev',
      providerActorType: 'bot',
      source: 'env',
    });
  });

  it('reports EAS robot users by project ID', async () => {
    const dir = await createTempDir('zephyr-eas-no-git-');

    const identity = await inferCiTokenIdentity({
      EAS_BUILD: 'true',
      EAS_BUILD_PROJECT_ID: 'project-id',
      EAS_BUILD_WORKINGDIR: dir,
    });

    expect(identity).toEqual({
      provider: 'eas',
      issuer: 'https://expo.dev',
      providerSubject: 'project-id',
      username: undefined,
      providerActorType: 'bot',
      source: 'env',
    });
  });

  it('prefers GitHub Actions identity for local EAS builds on GitHub', async () => {
    const identity = await inferCiTokenIdentity({
      EAS_BUILD: 'true',
      EAS_BUILD_USERNAME: 'expo-dev',
      GITHUB_ACTIONS: 'true',
      GITHUB_ACTOR: 'octocat',
      GITHUB_ACTOR_ID: '12345',
    });

    expect(identity?.provider).toBe('github');
  });

  async function createTempDir(prefix: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  async function createGitRepo(
    authorEmail: string
  ): Promise<{ dir: string; commit: string }> {
    const dir = await createTempDir('zephyr-eas-git-');
    const git = (...args: string[]) =>
      execFileSync('git', args, {
        cwd: dir,
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Author',
          GIT_AUTHOR_EMAIL: authorEmail,
          GIT_COMMITTER_NAME: 'Committer',
          GIT_COMMITTER_EMAIL: 'committer@example.com',
        },
      }).trim();

    git('init', '-q');
    git('commit', '-q', '--allow-empty', '--no-gpg-sign', '-m', 'init');
    return { dir, commit: git('rev-parse', 'HEAD') };
  }

  async function writeGitHubEvent(payload: Record<string, unknown>): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'zephyr-github-event-'));
    tempDirs.push(dir);
    const eventPath = join(dir, 'event.json');
    await writeFile(eventPath, JSON.stringify(payload), 'utf8');
    return eventPath;
  }
});
