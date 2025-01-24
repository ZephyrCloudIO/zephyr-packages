import { promisify } from 'node:util';
import { exec as execCB } from 'node:child_process';
import {
  createApplicationUid,
  ZE_IS_PREVIEW,
  ZEPHYR_API_ENDPOINT,
} from 'zephyr-edge-contract';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { homedir } from 'node:os';
import * as fs from 'node:fs';
import { Configuration as RspackConfiguration } from '@rspack/core';
import { withZephyr } from '../rspack-plugin/with-zephyr';
import { ZeRspackPlugin } from '../rspack-plugin/ze-rspack-plugin';
import {
  type ZeApplicationConfig,
  getPackageJson,
  getGitInfo,
  getAppConfig,
  saveAppConfig,
  getSecretToken,
} from 'zephyr-agent';

jest.mock('is-ci', () => false);

const runner = ZE_IS_PREVIEW() ? describe : describe.skip;

const exec = promisify(execCB);

runner('Rspack Plugin', () => {
  // const gitUserName = 'Néstor';
  // const gitEmail = 'nestor@nstlopez.com';
  // const gitRemoteOrigin = 'git@github.com:nstlopez/zephyr-packages.git';

  // const appOrg = 'nstlopez';
  // const appProject = 'zephyr-packages';
  const gitUserName = 'Test User';
  const gitEmail = 'test.user@valor-software.com';
  const gitRemoteOrigin = 'git@github.com:TestZephyrCloudIO/test-zephyr-packages.git';

  const appOrg = 'testzephyrcloudio';
  const appProject = 'test-zephyr-packages';

  const packageJsonPath = path.resolve('examples/sample-rspack-application');
  const appName = 'sample-rspack-application';
  const application_uid = `${appName}.${appProject}.${appOrg}`;
  const user_uuid = crypto.randomBytes(16).toString('hex');

  const dev_api_gate_url =
    process.env['ZE_API_GATE'] ?? 'https://zeapi.zephyrcloudapp.dev';

  const integrationTestTimeout = 5 * 60000; // 5 minute timeout for EDGE cache

  beforeAll(async () => {
    const zephyrAppFolder = path.join(homedir(), '.zephyr');
    // Clean Zephyr cache
    if (fs.existsSync(zephyrAppFolder)) {
      const files = fs.readdirSync(zephyrAppFolder);
      files.forEach((file) => {
        fs.rmSync(path.join(zephyrAppFolder, file));
      });
    }

    // Setup git configuration
    await exec(`git config --add user.name "${gitUserName}"`);
    await exec(`git config --add user.email "${gitEmail}"`);
    await exec(`git config --add remote.origin.url ${gitRemoteOrigin}`);

    // Setup application configuration
    const appConfig = await _loadAppConfig(application_uid);
    appConfig.email = gitEmail;
    appConfig.username = gitUserName;
    appConfig.user_uuid = user_uuid;
    await saveAppConfig(application_uid, appConfig);
  });

  afterAll(async () => {
    // Cleanup git configuration
    await exec(`git config --unset user.name "${gitUserName}"`);
    await exec(`git config --unset user.email "${gitEmail}"`);
    await exec(`git config --unset remote.origin.url ${gitRemoteOrigin}`);
  });

  describe('Configuration Tests', () => {
    it('should verify git configuration', async () => {
      const gitInfo = await getGitInfo();

      expect(gitInfo.git.name).toBe(gitUserName);
      expect(gitInfo.git.email).toBe(gitEmail);
      expect(gitInfo.git.commit).toBeTruthy();

      expect(gitInfo.app.org).toBe(appOrg);
      expect(gitInfo.app.project).toBe(appProject);
    });

    it('should verify package.json configuration', async () => {
      const packageJson = await getPackageJson(packageJsonPath);
      expect(packageJson.name).toBe(appName);
      expect(packageJson.version).toBeTruthy();
    });

    it('should verify applicationUID creation', async () => {
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
  });

  describe('Plugin Tests', () => {
    it('should properly transform rspack configuration', async () => {
      const baseConfig: RspackConfiguration = {
        context: packageJsonPath,
        output: {
          path: path.join(packageJsonPath, 'dist'),
        },
        plugins: [],
      };

      const transformedConfig = await withZephyr()(baseConfig);

      // Verify plugin was added
      const zePlugin = transformedConfig.plugins?.find(
        (plugin) => plugin instanceof ZeRspackPlugin
      );
      expect(zePlugin).toBeTruthy();
    });

    it('should respect wait_for_index_html option', async () => {
      const baseConfig: RspackConfiguration = {
        context: packageJsonPath,
        output: {
          path: path.join(packageJsonPath, 'dist'),
        },
        plugins: [],
      };

      const transformedConfig = await withZephyr({ wait_for_index_html: true })(
        baseConfig
      );

      const zePlugin = transformedConfig.plugins?.find(
        (plugin) => plugin instanceof ZeRspackPlugin
      ) as ZeRspackPlugin;

      expect(zePlugin['_options'].wait_for_index_html).toBe(true);
    });
  });

  describe('Deployment Tests', () => {
    it('should verify appConfig', async () => {
      const savedConfig = await getAppConfig(application_uid);
      expect(savedConfig?.email).toEqual(gitEmail);
      expect(savedConfig?.username).toEqual(gitUserName);
      expect(savedConfig?.user_uuid).toEqual(user_uuid);
    });

    it(
      'should successfully deploy rspack application to Zephyr',
      async () => {
        const envs = [
          `ZE_IS_PREVIEW=${ZE_IS_PREVIEW()}`,
          `ZE_API=${ZEPHYR_API_ENDPOINT()}`,
          `ZE_API_GATE=${dev_api_gate_url}`,
          `ZE_SECRET_TOKEN=${getSecretToken()}`,
          `DEBUG=zephyr:*`,
        ];

        // Execute rspack build command
        const cmd = [
          ...envs,
          `npx nx run sample-rspack-application:build --skip-nx-cache --verbose`,
        ].join(' ');
        await exec(cmd);

        // Verify deployment
        const deployResultUrls = await _getAppTagUrls(application_uid);
        expect(deployResultUrls).toBeTruthy();

        // Check each deployed URL
        for (const url of deployResultUrls) {
          expect(url).toBeTruthy();
          const content = await _fetchContent(url);
          const match = content.match(/<title>([^<]+)<\/title>/);
          expect(match).toBeTruthy();
          expect(match?.[1]).toEqual('SampleRspackApp');
        }

        // Cleanup after deployment
        await _cleanUp(application_uid);
      },
      integrationTestTimeout
    );
  });
});

// Helper functions for API interactions
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

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret_token}`,
      },
    });
    const json = await response.json();

    // if (json.statusCode !== 200) {
    //   throw new Error(`Failed to load app config. API response: ${json.statusCode} | ${JSON.stringify(json)}`);
    // }

    return json.value;
  } catch (error) {
    throw new Error(`Failed to load app config: ${error}`);
  }
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
    const contentRefetchTimeout = 60000; // 1 minute retry timeout
    await new Promise((resolve) => setTimeout(resolve, contentRefetchTimeout));
    return _fetchContent(url, counter + 1);
  }
  return content;
}
