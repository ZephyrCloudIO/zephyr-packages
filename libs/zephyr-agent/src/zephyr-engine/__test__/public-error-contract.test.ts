// Given controlled API failures, when the public engine initializes, then operation and reason survive every internal boundary.
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { execFile as nodeExecFile } from 'node:child_process';
import { ZephyrEngine } from '../../index';
import { invalidateApplicationConfigCache } from '../../lib/edge-requests/get-application-configuration';

const mocks = rs.hoisted(() => ({
  checkAuth: rs.fn(),
  cleanTokens: rs.fn(),
  fetchWithRetries: rs.fn(),
  getAppConfig: rs.fn(),
  getHashList: rs.fn(),
  getPackageJson: rs.fn(),
  getToken: rs.fn(),
  logger: rs.fn(),
  saveAppConfig: rs.fn(),
}));

rs.mock('ci-info', () => ({ isCI: false }));
rs.mock('node:child_process', () => ({ execFile: rs.fn() }));
rs.mock('../../lib/auth/login', () => ({
  checkAuth: mocks.checkAuth,
  isTokenStillValid: rs.fn(() => true),
}));
rs.mock('../../lib/build-context/ze-util-read-package-json', () => ({
  getPackageJson: mocks.getPackageJson,
}));
rs.mock('../../lib/build-context/zephyr-config', () => ({
  getZephyrConfig: rs.fn(() => ({
    org: 'test-org',
    project: 'test-project',
    appName: 'test-app',
  })),
  mergeRemoteDependencies: rs.fn(),
  resolveZephyrContextDirectory: rs.fn((context: string) => context),
}));
rs.mock('../../lib/edge-hash-list/distributed-hash-control', () => ({
  get_hash_list: mocks.getHashList,
}));
rs.mock('../../lib/http/fetch-with-retries', () => ({
  fetchWithRetries: mocks.fetchWithRetries,
}));
rs.mock('../../lib/logging', () => ({
  ze_log: {
    app: rs.fn(),
    auth: rs.fn(),
    git: rs.fn(),
    init: rs.fn(),
  },
}));
rs.mock('../../lib/logging/debug', () => ({
  ze_log: { error: rs.fn(), http: rs.fn() },
}));
rs.mock('../../lib/logging/ze-log-event', () => ({
  logger: rs.fn(() => mocks.logger),
  logFn: rs.fn(),
}));
rs.mock('../../lib/node-persist/application-configuration', () => ({
  getAppConfig: mocks.getAppConfig,
  getApplicationConfigStorageScope: rs.fn(() => ({
    apiEndpoint: 'https://api.example',
    apiGatewayEndpoint: 'https://gateway.example',
    environment: null,
    preview: false,
    principalFingerprint: 'test-principal',
  })),
  saveAppConfig: mocks.saveAppConfig,
}));
rs.mock('../../lib/node-persist/secret-token', () => ({
  getSecretToken: rs.fn(() => 'test-access-token'),
  hasSecretToken: rs.fn(() => true),
}));
rs.mock('../../lib/node-persist/token', () => ({
  cleanTokens: mocks.cleanTokens,
  getToken: mocks.getToken,
}));
rs.mock('../../lib/version/outdated-plugin-warning', () => ({
  maybeShowOutdatedPluginWarning: rs.fn(),
}));

type ExecCallback = (error: Error, stdout: string, stderr: string) => void;

function jsonResponse(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('public initialization error contract', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    invalidateApplicationConfigCache();
    mocks.checkAuth.mockResolvedValue(undefined);
    mocks.getAppConfig.mockResolvedValue(null);
    mocks.getHashList.mockResolvedValue({ hash_set: new Set<string>() });
    mocks.getPackageJson.mockResolvedValue({ name: 'test-app', version: '1.0.0' });
    mocks.getToken.mockResolvedValue('test-access-token');
    mocks.saveAppConfig.mockImplementation(
      async (_applicationUid: string, config: unknown) => config
    );
    (nodeExecFile as unknown as ReturnType<typeof rs.fn>).mockImplementation(
      (_file: string, _args: string[], _options: unknown, callback: ExecCallback) =>
        callback(new Error('Not a git repository'), '', 'fatal: not a repository')
    );
  });

  it.each([
    [401, 'ZE10018', 'ZE10018'],
    [403, 'ZE10022', 'ZE10022'],
    [503, 'ZE40035', 'ZE40035'],
  ] as const)(
    'preserves a %i user-info failure through the package entry',
    async (status, code, reason) => {
      mocks.fetchWithRetries.mockResolvedValueOnce(jsonResponse(status, { status }));

      await expect(
        ZephyrEngine.create({ builder: 'vite', context: '/workspace/test-app' })
      ).rejects.toMatchObject({ code, operation: 'get-user-info', reason });
    }
  );

  it('preserves application access denial through the package entry', async () => {
    mocks.fetchWithRetries
      .mockResolvedValueOnce(
        jsonResponse(200, {
          value: { name: 'Test User', email: 'user@example.com', id: 'user-id' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(403, { message: 'Forbidden' }));

    await expect(
      ZephyrEngine.create({ builder: 'vite', context: '/workspace/test-app' })
    ).rejects.toMatchObject({
      code: 'ZE20014',
      operation: 'get-application-config',
      reason: 'ZE10022',
    });
  });

  it('preserves Build-ID service failure through the package entry', async () => {
    mocks.fetchWithRetries
      .mockResolvedValueOnce(
        jsonResponse(200, {
          value: { name: 'Test User', email: 'user@example.com', id: 'user-id' },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          value: {
            application_uid: 'test-app.test-project.test-org',
            BUILD_ID_ENDPOINT: 'https://build-id.example',
            EDGE_URL: 'https://edge.example',
            jwt: 'write-capability',
            user_uuid: 'user-id',
            username: 'test-user',
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse(503, { message: 'Unavailable' }));

    await expect(
      ZephyrEngine.create({ builder: 'vite', context: '/workspace/test-app' })
    ).rejects.toMatchObject({
      code: 'ZE10019',
      operation: 'create-build-id',
      reason: 'ZE40035',
    });
  });
});
