import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZeApplicationConfig } from './upload-provider-options';
import {
  getAppConfig,
  getApplicationConfigStorageScope,
  saveAppConfig,
} from './application-configuration';

const mocks = rs.hoisted(() => ({
  values: new Map<string, unknown>(),
  apiEndpoint: 'https://api.zephyr-cloud.io',
  apiGatewayEndpoint: 'https://zeapi.zephyrcloud.app',
  environment: undefined as string | undefined,
  preview: false,
  setItem: rs.fn(),
  getItem: rs.fn(),
}));

rs.mock('node-persist', () => ({
  init: rs.fn().mockResolvedValue(undefined),
  setItem: mocks.setItem,
  getItem: mocks.getItem,
  removeItem: rs.fn(async (key: string) => {
    mocks.values.delete(key);
  }),
}));

rs.mock('zephyr-edge-contract', () => ({
  ZEPHYR_API_ENDPOINT: rs.fn(() => mocks.apiEndpoint),
  ZE_API_ENDPOINT: rs.fn(() => mocks.apiGatewayEndpoint),
  ZE_ENV: rs.fn(() => mocks.environment),
  ZE_IS_PREVIEW: rs.fn(() => mocks.preview),
  formatString: rs.fn((template: string, values: Record<string, string>) =>
    template.replace(/{{\s*([^}\s]+)\s*}}/g, (_match, key: string) => values[key] ?? '')
  ),
  stripAnsi: rs.fn((value: string) => value),
}));

function config(application_uid: string, jwt: string): ZeApplicationConfig {
  return {
    application_uid,
    BUILD_ID_ENDPOINT: '/build-id',
    EDGE_URL: 'https://edge.example',
    DELIMITER: '-',
    PLATFORM: 'cloudflare' as never,
    email: 'developer@example.com',
    jwt,
    user_uuid: 'user-id',
    username: 'developer',
  };
}

describe('persisted application configuration', () => {
  beforeEach(() => {
    mocks.values.clear();
    mocks.apiEndpoint = 'https://api.zephyr-cloud.io';
    mocks.apiGatewayEndpoint = 'https://zeapi.zephyrcloud.app';
    mocks.environment = undefined;
    mocks.preview = false;
    mocks.setItem.mockReset().mockImplementation(async (key: string, value: unknown) => {
      mocks.values.set(key, value);
    });
    mocks.getItem
      .mockReset()
      .mockImplementation(async (key: string) => mocks.values.get(key));
  });

  it('isolates the same application across API, gateway, and environment scopes', async () => {
    const applicationUid = 'app.project.org';
    await saveAppConfig(applicationUid, config(applicationUid, 'production-jwt'));
    const productionKey = mocks.setItem.mock.calls[0]?.[0] as string;

    mocks.apiEndpoint = 'https://preview-api.zephyr.example';
    mocks.apiGatewayEndpoint = 'https://preview-gateway.zephyr.example';
    mocks.environment = 'preview';

    await expect(getAppConfig(applicationUid)).resolves.toBeUndefined();
    await saveAppConfig(applicationUid, config(applicationUid, 'preview-jwt'));
    const previewKey = mocks.setItem.mock.calls[1]?.[0] as string;
    expect(previewKey).not.toBe(productionKey);
    await expect(getAppConfig(applicationUid)).resolves.toMatchObject({
      jwt: 'preview-jwt',
    });

    mocks.apiEndpoint = 'https://api.zephyr-cloud.io';
    mocks.apiGatewayEndpoint = 'https://zeapi.zephyrcloud.app';
    mocks.environment = undefined;
    await expect(getAppConfig(applicationUid)).resolves.toMatchObject({
      jwt: 'production-jwt',
    });
  });

  it('normalizes endpoint spellings before deriving the persistence identity', () => {
    const initial = getApplicationConfigStorageScope('principal-token');
    mocks.apiEndpoint = 'https://api.zephyr-cloud.io/';
    mocks.apiGatewayEndpoint = 'https://zeapi.zephyrcloud.app/';
    expect(getApplicationConfigStorageScope('principal-token')).toEqual(initial);
  });

  it('scopes persistence by a one-way principal fingerprint without storing the token', async () => {
    const applicationUid = 'app.project.org';
    const principalA = 'raw-principal-a-token';
    const principalB = 'raw-principal-b-token';
    const scopeA = getApplicationConfigStorageScope(principalA);
    const scopeB = getApplicationConfigStorageScope(principalB);

    expect(scopeA.principalFingerprint).not.toBe(scopeB.principalFingerprint);
    expect(JSON.stringify([scopeA, scopeB])).not.toContain(principalA);
    expect(JSON.stringify([scopeA, scopeB])).not.toContain(principalB);

    await saveAppConfig(
      applicationUid,
      config(applicationUid, 'principal-a-config-jwt'),
      scopeA
    );
    await expect(getAppConfig(applicationUid, scopeB)).resolves.toBeUndefined();
    await saveAppConfig(
      applicationUid,
      config(applicationUid, 'principal-b-config-jwt'),
      scopeB
    );

    const persistedRecords = JSON.stringify([...mocks.values.entries()]);
    expect(persistedRecords).not.toContain(principalA);
    expect(persistedRecords).not.toContain(principalB);
    await expect(getAppConfig(applicationUid, scopeA)).resolves.toMatchObject({
      jwt: 'principal-a-config-jwt',
    });
    await expect(getAppConfig(applicationUid, scopeB)).resolves.toMatchObject({
      jwt: 'principal-b-config-jwt',
    });
  });

  it('isolates explicit preview mode even when endpoints and environment match', async () => {
    const applicationUid = 'app.project.org';
    const productionScope = getApplicationConfigStorageScope('principal-token');
    await saveAppConfig(
      applicationUid,
      config(applicationUid, 'production-config-jwt'),
      productionScope
    );

    mocks.preview = true;
    const previewScope = getApplicationConfigStorageScope('principal-token');

    expect(previewScope.preview).toBe(true);
    expect(previewScope.principalFingerprint).toBe(productionScope.principalFingerprint);
    await expect(getAppConfig(applicationUid, previewScope)).resolves.toBeUndefined();
  });

  it('rejects legacy, mismatched, or tampered records before reuse', async () => {
    const applicationUid = 'app.project.org';
    const appConfig = config(applicationUid, 'valid-jwt');

    mocks.getItem.mockResolvedValueOnce(appConfig);
    await expect(getAppConfig(applicationUid)).resolves.toBeUndefined();

    await saveAppConfig(applicationUid, appConfig);
    const key = mocks.setItem.mock.calls[0]?.[0] as string;
    const stored = mocks.values.get(key) as {
      applicationUid: string;
      config: ZeApplicationConfig;
    };
    mocks.values.set(key, {
      ...stored,
      config: { ...stored.config, application_uid: 'other.project.org' },
    });
    await expect(getAppConfig(applicationUid)).resolves.toBeUndefined();
  });

  it('refuses to persist a configuration under another application UID', async () => {
    await expect(
      saveAppConfig('requested.project.org', config('other.project.org', 'jwt'))
    ).rejects.toThrow('requested.project.org');
    expect(mocks.setItem).not.toHaveBeenCalled();
  });
});
