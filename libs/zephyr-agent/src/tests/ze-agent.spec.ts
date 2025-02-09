import { promisify } from 'node:util';
import { exec as execCB } from 'node:child_process';
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
import {
  getAppConfig,
  saveAppConfig,
} from '../lib/node-persist/application-configuration';
import { getSecretToken } from '../lib/node-persist/secret-token';
import { ZeApplicationConfig } from '../lib/node-persist/upload-provider-options';
import { getBuildId } from '../lib/edge-requests/get-build-id';

// Both mocks are necessary in order to simulate user deployment but through
// our own CI. Our libs have different rules for CI execution (getGitInfo).
jest.mock('../lib/node-persist/secret-token', () => {
  const defaultExport = jest.requireActual('../lib/node-persist/secret-token');
  return {
    ...defaultExport,
    hasSecretToken: jest.fn().mockReturnValue(false),
  };
});

jest.mock('is-ci', () => false);

// Skip tests if not in preview mode
const runner = ZE_IS_PREVIEW() ? describe : describe.skip;

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

  const integrationTestTimeout = 5 * 60000; // 5 minute because EDGE cache time;

  beforeAll(async () => {
    const zephyrAppFolder = path.join(homedir(), '.zephyr');

    // Remove Zephyr cache
    if (fs.existsSync(zephyrAppFolder)) {
      const files = fs.readdirSync(zephyrAppFolder);
      files.forEach((file) => {
        fs.rmSync(path.join(zephyrAppFolder, file));
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

    expect(savedConfig?.email).toEqual(gitEmail);
    expect(savedConfig?.username).toEqual(gitUserName);
    expect(savedConfig?.user_uuid).toEqual(user_uuid);
  });

  it(
    'should deploy Webpack',
    async () => {
      const app = 'sample-webpack-application';
      const uuid = `${app}.${appProject}.${appOrg}`;

      const envs = [
        `ZE_IS_PREVIEW=${ZE_IS_PREVIEW()}`,
        `ZE_API=${ZEPHYR_API_ENDPOINT()}`,
        `ZE_API_GATE=${dev_api_gate_url}`,
        `ZE_SECRET_TOKEN=${getSecretToken()}`,
        `ZE_TEST_CI=true`,
        `DEBUG=zephyr:*`,
      ];
      const cmd = [
        'npx cross-env',
        ...envs,
        `npx nx run sample-webpack-application:build --skip-nx-cache --verbose`,
      ].join(' ');
      await exec(cmd);

      const deployResultUrls = await _getAppTagUrls(uuid);
      expect(deployResultUrls).toBeTruthy();

      for (const url of deployResultUrls) {
        expect(url).toBeTruthy();
        const content = await _fetchContent(url);
        const match = content.match(/<title>([^<]+)<\/title>/);
        expect(match).toBeTruthy();
        expect(match?.[1]).toEqual('SampleReactApp');

        await _verifyBuildId(content, uuid);
      }
      await _cleanUp(uuid);
    },
    integrationTestTimeout
  );

  it(
    'should deploy Rspack',
    async () => {
      const app = 'sample-rspack-application';
      const uuid = `${app}.${appProject}.${appOrg}`;

      const envs = [
        `ZE_IS_PREVIEW=${ZE_IS_PREVIEW()}`,
        `ZE_API=${ZEPHYR_API_ENDPOINT()}`,
        `ZE_API_GATE=${dev_api_gate_url}`,
        `ZE_SECRET_TOKEN=${getSecretToken()}`,
        `ZE_TEST_CI=true`,
        `DEBUG=zephyr:*`,
      ];

      const cmd = [
        'npx cross-env',
        ...envs,
        `npx nx run sample-rspack-application:build --skip-nx-cache --verbose`,
      ].join(' ');
      await exec(cmd);

      // Verify deployment
      const deployResultUrls = await _getAppTagUrls(uuid);
      expect(deployResultUrls).toBeTruthy();

      // Check each deployed URL
      for (const url of deployResultUrls) {
        expect(url).toBeTruthy();
        const content = await _fetchContent(url);
        const match = content.match(/<title>([^<]+)<\/title>/);
        expect(match).toBeTruthy();
        expect(match?.[1]).toEqual('SampleRspackApplication');

        await _verifyBuildId(content, uuid);
      }

      // Cleanup after deployment
      await _cleanUp(uuid);
    },
    integrationTestTimeout
  );

  it(
    'should deploy Vite',
    async () => {
      const app = 'vite-react-ts';
      const uuid = `${app}.${appProject}.${appOrg}`;

      const envs = [
        `ZE_IS_PREVIEW=${ZE_IS_PREVIEW()}`,
        `ZE_API=${ZEPHYR_API_ENDPOINT()}`,
        `ZE_API_GATE=${dev_api_gate_url}`,
        `ZE_SECRET_TOKEN=${getSecretToken()}`,
        `ZE_TEST_CI=true`,
        `DEBUG=zephyr:*`,
      ];

      const cmd = [
        'npx cross-env',
        ...envs,
        `npx nx run vite-react-ts:build --skip-nx-cache --verbose`,
      ].join(' ');
      await exec(cmd);

      // Verify deployment
      const deployResultUrls = await _getAppTagUrls(uuid);
      expect(deployResultUrls).toBeTruthy();

      // Check each deployed URL
      for (const url of deployResultUrls) {
        expect(url).toBeTruthy();
        const content = await _fetchContent(url);
        const match = content.match(/<title>([^<]+)<\/title>/);
        expect(match).toBeTruthy();
        expect(match?.[1]).toEqual('Vite + React + TS');
      }

      // Cleanup after deployment
      await _cleanUp(uuid);
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

async function _getAppTagUrls(application_uid: string): Promise<string[]> {
  const url = new URL(
    `/v2/builder-packages-api/deployed-tags/${application_uid}`,
    ZEPHYR_API_ENDPOINT()
  );
  const secret_token = getSecretToken();
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret_token}`,
    },
  });
  return response.json().then((data) => {
    return data.entities.map((tag: { remote_host: string }) => tag.remote_host);
  });
}

async function _cleanUp(application_uid: string): Promise<void> {
  const url = new URL(
    `/v2/builder-packages-api/cleanup-tests/${application_uid}`,
    ZEPHYR_API_ENDPOINT()
  );
  const secret_token = getSecretToken();
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret_token}`,
    },
  });
}

async function _fetchContent(url: string, counter = 0): Promise<string> {
  const response = await fetch(url);
  const content = await response.text();
  if (response.status === 404 || !content || counter > 5) {
    const contentRefetchTimeout = 60000; // 1 minute;
    await new Promise((resolve) => setTimeout(resolve, contentRefetchTimeout));
    return _fetchContent(url, counter + 1);
  }
  return content;
}

async function _verifyBuildId(content: string, uuid: string): Promise<void> {
  const buildIdMatch = content.match(
    /<meta name="zephyr-build-id" data-testid="ze-build-id" content="([^"]+)">/g
  );
  expect(buildIdMatch).toBeTruthy();

  if (buildIdMatch) {
    const buildId = buildIdMatch[1];
    const expectedBuildId = await getBuildId(uuid);
    expect(buildId).toBeTruthy();
    expect(buildId).toEqual(expectedBuildId);
  }
}
