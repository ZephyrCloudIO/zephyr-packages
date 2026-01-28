import { exec as execCB } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import {
  createApplicationUid,
  ZE_IS_PREVIEW,
  ZEPHYR_API_ENDPOINT,
} from 'zephyr-edge-contract';
import { getGitInfo } from '../lib/build-context/ze-util-get-git-info';
import { getPackageJson } from '../lib/build-context/ze-util-read-package-json';
import {
  getAppConfig,
  saveAppConfig,
} from '../lib/node-persist/application-configuration';
import { getSecretToken } from '../lib/node-persist/secret-token';
import type { ZeApplicationConfig } from '../lib/node-persist/upload-provider-options';

// ---------------- mocks ----------------

// Both mocks are necessary in order to simulate user deployment but through
// our own CI. Our libs have different rules for CI execution (getGitInfo).
jest.mock('../lib/node-persist/secret-token', () => {
  const actual = jest.requireActual('../lib/node-persist/secret-token');
  return {
    ...actual,
    hasSecretToken: jest.fn().mockReturnValue(false),
  };
});

jest.mock('is-ci', () => false);

// ---------------- execution guards ----------------

// Preview mode is required
const runner = ZE_IS_PREVIEW() ? describe : describe.skip;

// Deployment test must be explicitly enabled
const shouldRunE2E = process.env.ZE_RUN_AGENT_E2E === 'true';

const exec = promisify(execCB);

runner('ZeAgent', () => {
  const gitUserName = 'Test User';
  const gitEmail = 'test.user@valor-software.com';
  const gitRemoteOrigin = 'git@github.com:TestZephyrCloudIO/test-zephyr-mono.git';

  const appOrg = 'testzephyrcloudio';
  const appProject = 'test-zephyr-mono';

  const packageJsonPath = path.resolve('examples/sample-webpack-application');
  const appName = 'sample-webpack-application';
  const application_uid = `${appName}.${appProject}.${appOrg}`;
  const user_uuid = crypto.randomBytes(16).toString('hex');

  const dev_api_gate_url =
    process.env['ZE_API_GATE'] ?? 'https://zeapi.zephyrcloudapp.dev';

  const integrationTestTimeout = 5 * 60_000; // 5 minutes

  beforeAll(async () => {
    const zephyrAppFolder = path.join(homedir(), '.zephyr');

    if (fs.existsSync(zephyrAppFolder)) {
      fs.readdirSync(zephyrAppFolder).forEach((file) => {
        fs.rmSync(path.join(zephyrAppFolder, file), { recursive: true });
      });
    }

    await exec(`git config --add user.name "${gitUserName}"`);
    await exec(`git config --add user.email "${gitEmail}"`);
    await exec(`git config --add remote.origin.url ${gitRemoteOrigin}`);

    const appConfig = await _loadAppConfig(application_uid);
    appConfig.email = gitEmail;
    appConfig.username = gitUserName;
    appConfig.user_uuid = user_uuid;

    await saveAppConfig(application_uid, appConfig);
  });

  afterAll(async () => {
    await exec(`git config --unset user.name "${gitUserName}"`);
    await exec(`git config --unset user.email "${gitEmail}"`);
    await exec(`git config --unset remote.origin.url ${gitRemoteOrigin}`);
  });

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

    expect(savedConfig?.email).toBe(gitEmail);
    expect(savedConfig?.username).toBe(gitUserName);
    expect(savedConfig?.user_uuid).toBe(user_uuid);
  });

  (shouldRunE2E ? it : it.skip)(
    'should be deployed to Zephyr',
    async () => {
      const envs = [
        `ZE_IS_PREVIEW=${ZE_IS_PREVIEW()}`,
        `ZE_API=${ZEPHYR_API_ENDPOINT()}`,
        `ZE_API_GATE=${dev_api_gate_url}`,
        `ZE_SECRET_TOKEN=${getSecretToken()}`,
        `DEBUG=zephyr:*`,
      ];

      const cmd = [
        'npx cross-env',
        ...envs,
        'npx nx run sample-webpack-application:build --skip-nx-cache --verbose',
      ].join(' ');

      await exec(cmd);

      const deployResultUrls = await _getAppTagUrls(application_uid);
      expect(deployResultUrls.length).toBeGreaterThan(0);

      for (const url of deployResultUrls) {
        const content = await _fetchContent(url);
        const match = content.match(/<title>([^<]+)<\/title>/);
        expect(match?.[1]).toBe('SampleReactApp');
      }

      await _cleanUp(application_uid);
    },
    integrationTestTimeout
  );
});

// ---------------- helpers ----------------

async function _loadAppConfig(application_uid: string): Promise<ZeApplicationConfig> {
  const url = new URL(
    '/v2/builder-packages-api/application-config',
    ZEPHYR_API_ENDPOINT()
  );
  url.searchParams.set('application-uid', application_uid);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getSecretToken()}`,
    },
  });

  return response.json().then((r) => r.value);
}

async function _getAppTagUrls(application_uid: string): Promise<string[]> {
  const url = new URL(
    `/v2/builder-packages-api/deployed-tags/${application_uid}`,
    ZEPHYR_API_ENDPOINT()
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getSecretToken()}`,
    },
  });

  return response
    .json()
    .then((r) => r.entities.map((tag: { remote_host: string }) => tag.remote_host));
}

async function _cleanUp(application_uid: string): Promise<void> {
  const url = new URL(
    `/v2/builder-packages-api/cleanup-tests/${application_uid}`,
    ZEPHYR_API_ENDPOINT()
  );

  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretToken()}`,
    },
  });
}

async function _fetchContent(url: string, counter = 0): Promise<string> {
  const response = await fetch(url);
  const content = await response.text();

  if (response.status === 404 || !content || counter > 5) {
    await new Promise((r) => setTimeout(r, 60_000));
    return _fetchContent(url, counter + 1);
  }

  return content;
}
