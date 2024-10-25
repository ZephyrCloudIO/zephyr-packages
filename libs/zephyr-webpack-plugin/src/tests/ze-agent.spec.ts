import { promisify } from 'node:util';
import { exec as execCB } from 'node:child_process';
import { getGitInfo, getPackageJson } from 'zephyr-agent';
import {
  createApplicationUID,
  getAppConfig,
  saveAppConfig,
  ZeApplicationConfig,
  ZEPHYR_API_ENDPOINT,
  ZE_IS_PREVIEW,
  getSecretToken,
} from 'zephyr-edge-contract';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { homedir } from 'node:os';
import * as fs from 'node:fs';

jest.mock('zephyr-edge-contract', () => {
  const defaultExport = jest.requireActual('zephyr-edge-contract');
  return {
    ...defaultExport,
    hasSecretToken: jest.fn().mockReturnValue(false),
  };
});

const exec = promisify(execCB);
describe('ZeAgent', () => {
  // Skip tests if not in preview mode
  if (!ZE_IS_PREVIEW()) {
    it('should skip tests', () => {
      expect(true).toBeTruthy();
    });
    return;
  }

  const gitUserName = 'Test User';
  const gitEmail = 'test.user@valor-software.com';
  const gitRemoteOrigin = 'git@github.com:TestZephyrCloudIO/test-zephyr-mono.git';

  const appOrg = 'testzephyrcloudio';
  const appProject = 'test-zephyr-mono';

  const packageJsonPath = path.resolve('examples/sample-webpack-application');
  const appName = 'sample-webpack-application';
  const application_uid = `${appName}.${appProject}.${appOrg}`;
  const user_uuid = crypto.randomBytes(16).toString('hex');

  const dev_api_gate_url = process.env['ZE_API_GATE'] ?? 'https://zeapi.zephyrcloudapp.dev';

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
      createApplicationUID({
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
      const envs = [
        `ZE_IS_PREVIEW=${ZE_IS_PREVIEW()}`,
        `ZE_API=${ZEPHYR_API_ENDPOINT()}`,
        `ZE_API_GATE=${dev_api_gate_url}`,
        `ZE_SECRET_TOKEN=${getSecretToken()}`,
        `DEBUG=zephyr:*`,
      ];
      const cmd = [...envs, `npx nx run sample-webpack-application:build --skip-nx-cache --verbose`].join(' ');
      await exec(cmd);
      const deployResultUrls = await _getAppTagUrls(application_uid);
      expect(deployResultUrls).toBeTruthy();
      for (const url of deployResultUrls) {
        console.log('fetching url:', url);
        expect(url).toBeTruthy();
        const content = await _fetchContent(url);
        const match = content.match(/<title>([^<]+)<\/title>/);
        expect(match).toBeTruthy();
        expect(match?.[1]).toEqual('SampleReactApp');
      }
      await _cleanUp(application_uid);
    },
    integrationTestTimeout
  );
});

async function _loadAppConfig(application_uid: string): Promise<ZeApplicationConfig> {
  const url = new URL(`/v2/builder-packages-api/application-config`, ZEPHYR_API_ENDPOINT());
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
  const url = new URL(`/v2/builder-packages-api/deployed-tags/${application_uid}`, ZEPHYR_API_ENDPOINT());
  const secret_token = getSecretToken();
  console.log('token:', secret_token);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret_token}`,
    },
  });
  return response.json().then((data) => {
    console.log('data:', data);
    return data.entities.map((tag: { remote_host: string }) => tag.remote_host);
  });
}

async function _cleanUp(application_uid: string): Promise<void> {
  const url = new URL(`/v2/builder-packages-api/cleanup-tests/${application_uid}`, ZEPHYR_API_ENDPOINT());
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
