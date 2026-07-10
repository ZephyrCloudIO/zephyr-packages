import { afterAll, beforeAll, describe, expect, it, rs } from '@rstest/core';

import { promisify } from 'node:util';
import { exec as execCB, execFile as execFileCB } from 'node:child_process';
import { getGitInfo } from '../lib/build-context/ze-util-get-git-info';
import { getPackageJson } from '../lib/build-context/ze-util-read-package-json';
import {
  createApplicationUid,
  ZE_IS_PREVIEW,
  ZEPHYR_API_ENDPOINT,
} from 'zephyr-edge-contract';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { homedir } from 'node:os';
import * as fs from 'node:fs';
import nodePersist from 'node-persist';
import {
  getAppConfig,
  saveAppConfig,
} from '../lib/node-persist/application-configuration';
import { getAppDeployResult } from '../lib/node-persist/app-deploy-result-cache';
import { getSecretToken } from '../lib/node-persist/secret-token';
import { ZE_STORAGE_PATH } from '../lib/node-persist/storage-keys';
import type { ZeApplicationConfig } from '../lib/node-persist/upload-provider-options';

// Both mocks are necessary in order to simulate user deployment but through
// our own CI. Our libs have different rules for CI execution (getGitInfo).
rs.mock('../lib/node-persist/secret-token', () => {
  const defaultExport = rs.requireActual('../lib/node-persist/secret-token');
  return {
    ...defaultExport,
    hasSecretToken: rs.fn().mockReturnValue(false),
  };
});

rs.mock('is-ci', () => ({ default: false }));

// This spec performs a real deployment. Preview mode is shared by ordinary unit-test
// jobs, so require a dedicated opt-in on an ephemeral CI runner rather than unexpectedly
// uploading from `pnpm test` or deleting a developer's authenticated ~/.zephyr store.
function shouldRunDeploymentE2E(options: {
  preview: boolean;
  optedIn: boolean;
  ci: boolean;
}): boolean {
  return options.preview && options.optedIn && options.ci;
}

const runner = shouldRunDeploymentE2E({
  preview: ZE_IS_PREVIEW(),
  optedIn: process.env['ZE_RUN_AGENT_DEPLOYMENT_E2E'] === 'true',
  ci: process.env['CI'] === 'true',
})
  ? describe
  : describe.skip;

const exec = promisify(execCB);
const execFile = promisify(execFileCB);

function createTestRunSuffix(
  env: NodeJS.ProcessEnv = process.env,
  randomSuffix = () => crypto.randomBytes(4).toString('hex')
): string {
  return [
    env['GITHUB_RUN_ID'],
    env['GITHUB_RUN_ATTEMPT'],
    env['GITHUB_JOB'],
    env['RUNNER_OS'],
    randomSuffix(),
  ]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function createDeploymentInvocation(options: {
  preview: boolean;
  apiEndpoint: string;
  apiGate: string;
  secretToken: string;
}): {
  executable: string;
  args: string[];
  env: NodeJS.ProcessEnv;
} {
  return {
    executable: 'pnpm',
    args: [
      '-w',
      'exec',
      'turbo',
      'run',
      'build',
      '--filter=sample-webpack-application',
      '--force',
    ],
    env: {
      ...process.env,
      ZE_IS_PREVIEW: String(options.preview),
      ZE_API: options.apiEndpoint,
      ZE_API_GATE: options.apiGate,
      ZE_SECRET_TOKEN: options.secretToken,
      DEBUG: 'zephyr:*',
    },
  };
}

describe('ZeAgent deployment child process', () => {
  it('requires preview mode, explicit opt-in, and CI isolation', () => {
    expect(shouldRunDeploymentE2E({ preview: true, optedIn: true, ci: true })).toBe(true);
    expect(shouldRunDeploymentE2E({ preview: true, optedIn: true, ci: false })).toBe(
      false
    );
    expect(shouldRunDeploymentE2E({ preview: false, optedIn: true, ci: true })).toBe(
      false
    );
    expect(shouldRunDeploymentE2E({ preview: true, optedIn: false, ci: true })).toBe(
      false
    );
  });

  it('passes the secret token only through the child environment', () => {
    const secretToken = 'test-token-that-must-not-appear-in-argv';
    const invocation = createDeploymentInvocation({
      preview: true,
      apiEndpoint: 'https://api.example.test',
      apiGate: 'https://gateway.example.test',
      secretToken,
    });

    expect([invocation.executable, ...invocation.args].join('\0')).not.toContain(
      secretToken
    );
    expect(invocation.env['ZE_SECRET_TOKEN']).toBe(secretToken);
    expect(
      Object.entries(invocation.env).filter(([, value]) => value === secretToken)
    ).toEqual([['ZE_SECRET_TOKEN', secretToken]]);
  });

  it('creates collision-resistant deployment identities for parallel jobs', () => {
    expect(
      createTestRunSuffix(
        {
          GITHUB_RUN_ID: '1234',
          GITHUB_RUN_ATTEMPT: '2',
          GITHUB_JOB: 'test (ubuntu-latest)',
          RUNNER_OS: 'Linux',
        },
        () => 'abc123'
      )
    ).toBe('1234-2-test-ubuntu-latest-linux-abc123');
  });
});

runner('ZeAgent', () => {
  const testRunSuffix = createTestRunSuffix();
  const gitUserName = 'Test User';
  const gitEmail = `test.user-${testRunSuffix}@valor-software.com`;

  const appOrg = 'testzephyrcloudio';
  const appProject = `test-zephyr-mono-${testRunSuffix}`;
  const gitRemoteOrigin = `git@github.com:TestZephyrCloudIO/${appProject}.git`;

  const packageJsonPath = path.resolve(
    import.meta.dirname,
    '../../../../examples/sample-webpack-application'
  );
  const appName = 'sample-webpack-application';
  const application_uid = `${appName}.${appProject}.${appOrg}`;
  const user_uuid = crypto.randomBytes(16).toString('hex');

  const dev_api_gate_url =
    process.env['ZE_API_GATE'] ?? 'https://zeapi.zephyrcloudapp.dev';

  const integrationTestTimeout = 10 * 60_000;

  beforeAll(async () => {
    const zephyrAppFolder = path.join(homedir(), '.zephyr');
    // Remove Zephyr cache
    if (fs.existsSync(zephyrAppFolder)) {
      const files = fs.readdirSync(zephyrAppFolder);
      files.forEach((file) => {
        fs.rmSync(path.join(zephyrAppFolder, file), { recursive: true });
      });
    }
    // node-persist initializes during module evaluation. Re-initialize after clearing its
    // files so its in-memory index cannot point at entries which no longer exist.
    fs.mkdirSync(ZE_STORAGE_PATH, { recursive: true });
    await nodePersist.init({
      dir: ZE_STORAGE_PATH,
      forgiveParseErrors: true,
    });
    await exec(`git config --add user.name "${gitUserName}"`);
    await exec(`git config --add user.email "${gitEmail}"`);
    await exec(`git config --add remote.origin.url ${gitRemoteOrigin}`);

    const appConfig = await _loadAppConfig(application_uid);
    appConfig.email = gitEmail;
    appConfig.username = gitUserName;
    appConfig.user_uuid = user_uuid;
    await saveAppConfig(application_uid, appConfig);
  }, integrationTestTimeout);

  afterAll(async () => {
    await exec(`git config --unset user.name "${gitUserName}"`);
    await exec(`git config --unset user.email "${gitEmail}"`);
    await exec(`git config --unset remote.origin.url ${gitRemoteOrigin}`);
  }, integrationTestTimeout);

  it('should test git configuration', async () => {
    const gitInfo = await getGitInfo();

    expect(gitInfo.git.name).toBe(gitUserName);
    expect(gitInfo.git.email).toBe(gitEmail);
    expect(gitInfo.git.commit).toBeTruthy();

    expect(gitInfo.app.org).toBe(appOrg);
    expect(gitInfo.app.project).toBe(appProject);
  });

  it('should test package.json configuration', async () => {
    const packageJson = await getPackageJson(packageJsonPath);
    expect(packageJson.name).toBe(appName);
    expect(packageJson.version).toBeTruthy();
  });

  it('should test applicationUID', async () => {
    const gitInfo = await getGitInfo();
    const packageJson = await getPackageJson(packageJsonPath);
    expect(
      createApplicationUid({
        org: gitInfo.app.org,
        project: gitInfo.app.project,
        name: packageJson.name,
      })
    ).toBe(application_uid);
  });

  it('should test appConfig', async () => {
    const savedConfig = await getAppConfig(application_uid);

    expect(savedConfig?.email).toEqual(gitEmail);
    expect(savedConfig?.username).toEqual(gitUserName);
    expect(savedConfig?.user_uuid).toEqual(user_uuid);
  });

  it(
    'should be deployed to Zephyr',
    async () => {
      const secretToken = getSecretToken();
      if (!secretToken) {
        throw new Error('Secret token is required');
      }
      const invocation = createDeploymentInvocation({
        preview: ZE_IS_PREVIEW(),
        apiEndpoint: ZEPHYR_API_ENDPOINT(),
        apiGate: dev_api_gate_url,
        secretToken,
      });
      await execFile(invocation.executable, invocation.args, {
        env: invocation.env,
      });
      // The child process wrote the deploy result. Refresh node-persist's index before
      // reading so this test observes only this build instead of historical tag URLs.
      await nodePersist.init({
        dir: ZE_STORAGE_PATH,
        forgiveParseErrors: true,
      });
      const deployResult = await getAppDeployResult(application_uid);
      if (!deployResult) {
        throw new Error(`No deployment result found for ${application_uid}`);
      }
      expect(deployResult.snapshot.application_uid).toBe(application_uid);
      expect(deployResult.urls).toHaveLength(1);

      try {
        const [url] = deployResult.urls;
        expect(url).toBeTruthy();
        const content = await _fetchContent(url as string);
        const match = content.match(/<title>([^<]+)<\/title>/);
        expect(match).toBeTruthy();
        expect(match?.[1]).toEqual('SampleReactApp');
      } finally {
        await _cleanUp(application_uid);
      }
    },
    integrationTestTimeout
  );
});

async function _loadAppConfig(application_uid: string): Promise<ZeApplicationConfig> {
  const url = new URL(
    `/v2/builder-packages-api/application-config`,
    ZEPHYR_API_ENDPOINT()
  );
  url.searchParams.set('application-uid', application_uid);
  const secret_token = getSecretToken();
  if (!secret_token) {
    throw new Error('Secret token is required');
  }
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret_token}`,
    },
  });
  return response.json().then((data) => data.value);
}

async function _cleanUp(application_uid: string): Promise<void> {
  const url = new URL(
    `/v2/builder-packages-api/cleanup-tests/${application_uid}`,
    ZEPHYR_API_ENDPOINT()
  );
  const secret_token = getSecretToken();
  if (!secret_token) {
    throw new Error('Secret token is required');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret_token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to clean up ${application_uid}: ${response.status}`);
  }
}

async function _fetchContent(url: string, attempt = 0): Promise<string> {
  const maxAttempts = 6;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });
  const content = await response.text();
  if (response.status !== 404 && content) {
    return content;
  }

  if (attempt + 1 >= maxAttempts) {
    throw new Error(
      `Deployment did not become available after ${maxAttempts} attempts: ${url}`
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 30_000));
  return _fetchContent(url, attempt + 1);
}
