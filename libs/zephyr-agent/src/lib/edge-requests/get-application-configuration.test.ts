import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import {
  getApplicationConfiguration,
  invalidateApplicationConfigCache,
} from './get-application-configuration';

const mocks = rs.hoisted(() => ({
  makeRequest: rs.fn(),
  getToken: rs.fn(),
  isTokenStillValid: rs.fn(),
  getAppConfig: rs.fn(),
  saveAppConfig: rs.fn(),
  endpoint: {
    api: 'https://api.zephyr.com/',
    gateway: 'https://gateway.zephyr.com/',
    environment: null as string | null,
    preview: false,
  },
}));

rs.mock('../http/http-request', () => ({ makeRequest: mocks.makeRequest }));
rs.mock('../node-persist/token', () => ({ getToken: mocks.getToken }));
rs.mock('../auth/login', () => ({ isTokenStillValid: mocks.isTokenStillValid }));
rs.mock('../node-persist/application-configuration', () => ({
  getAppConfig: mocks.getAppConfig,
  saveAppConfig: mocks.saveAppConfig,
  getApplicationConfigStorageScope: rs.fn((token?: string) => {
    const fingerprint = Array.from(token ?? '<anonymous>').reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
      0
    );
    return {
      apiEndpoint: mocks.endpoint.api,
      apiGatewayEndpoint: mocks.endpoint.gateway,
      environment: mocks.endpoint.environment,
      preview: mocks.endpoint.preview,
      principalFingerprint: `test-${fingerprint.toString(36)}`,
    };
  }),
}));
rs.mock('../logging', () => ({ ze_log: { app: rs.fn() } }));
rs.mock('../logging/ze-log-event', () => ({ logFn: rs.fn() }));
rs.mock('zephyr-edge-contract', () => ({
  ze_api_gateway: {
    application_config: '/api/v1/application-config',
  },
}));

// Simplified test to ensure basic functionality works
describe('getApplicationConfiguration', () => {
  const mockMakeRequest = mocks.makeRequest;
  const mockGetToken = mocks.getToken;
  const mockIsTokenStillValid = mocks.isTokenStillValid;
  const mockGetAppConfig = mocks.getAppConfig;
  const mockSaveAppConfig = mocks.saveAppConfig;

  // Test data
  const application_uid = 'test-app-123';
  const token = 'test-jwt-token';
  const appConfig = {
    application_uid,
    EDGE_URL: 'https://edge.zephyr.com',
    jwt: token,
    fetched_at: Date.now(), // Current time
    user_uuid: 'user-123',
    username: 'test-user',
  };

  beforeEach(() => {
    rs.clearAllMocks();
    mocks.endpoint.api = 'https://api.zephyr.com/';
    mocks.endpoint.gateway = 'https://gateway.zephyr.com/';
    mocks.endpoint.environment = null;
    mocks.endpoint.preview = false;
    mockGetToken.mockResolvedValue(token);
    // Reset cache between tests
    invalidateApplicationConfigCache();
  });

  // Simple test that stored config is returned when available and valid
  it('should return stored config when available and token is valid', async () => {
    mockGetAppConfig.mockResolvedValue(appConfig);
    mockIsTokenStillValid.mockReturnValue(true);

    const result = await getApplicationConfiguration({ application_uid });

    expect(result).toEqual(appConfig);
    expect(mockGetAppConfig).toHaveBeenCalledWith(
      application_uid,
      expect.objectContaining({
        apiEndpoint: mocks.endpoint.api,
        apiGatewayEndpoint: mocks.endpoint.gateway,
        environment: null,
        preview: false,
        principalFingerprint: expect.any(String),
      })
    );
    expect(mockIsTokenStillValid).toHaveBeenCalledWith(token);
    expect(mockMakeRequest).not.toHaveBeenCalled();
  });

  // Simple test to verify a successful fetch of new app config
  it('should fetch new config when no stored config exists', async () => {
    // Mock no stored config
    mockGetAppConfig.mockResolvedValue(null);

    // Mock API response
    const newConfig = {
      application_uid,
      EDGE_URL: 'https://edge.zephyr.com',
      jwt: 'new-jwt-token',
    };

    // Mock the request to return success
    mockMakeRequest.mockResolvedValue([true, null, { value: newConfig }]);

    const result = await getApplicationConfiguration({ application_uid });

    expect(mockMakeRequest).toHaveBeenCalled();
    expect(mockSaveAppConfig).toHaveBeenCalled();
    expect(result).toMatchObject(newConfig);
  });

  // Test in-memory caching
  it('should use cached config and not call getAppConfig again', async () => {
    // First call - sets up the cache
    mockGetAppConfig.mockResolvedValue(appConfig);
    mockIsTokenStillValid.mockReturnValue(true);

    await getApplicationConfiguration({ application_uid });

    // Reset mocks to verify they're not called again
    mockGetAppConfig.mockClear();

    // Second call - should use cache
    const result = await getApplicationConfiguration({ application_uid });

    expect(result).toEqual(appConfig);
    expect(mockGetAppConfig).not.toHaveBeenCalled();
  });

  // Test parallel requests
  it('should handle parallel requests by returning the same promise', async () => {
    mockGetAppConfig.mockResolvedValue(null);

    const newConfig = {
      application_uid,
      EDGE_URL: 'https://edge.zephyr.com',
      jwt: 'new-jwt-token',
    };

    mockMakeRequest.mockResolvedValue([true, null, { value: newConfig }]);

    // Make three parallel requests
    const promises = [
      getApplicationConfiguration({ application_uid }),
      getApplicationConfiguration({ application_uid }),
      getApplicationConfiguration({ application_uid }),
    ];

    const results = await Promise.all(promises);

    // All results should be the same
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);

    // makeRequest should only be called once
    expect(mockMakeRequest).toHaveBeenCalledTimes(1);
  });

  it('isolates parallel requests and credentials by application identity', async () => {
    const appA = 'app-a';
    const appB = 'app-b';
    mockGetAppConfig.mockResolvedValue(null);
    mockMakeRequest.mockImplementation(async (url: URL) => {
      const requestedApplication = url.pathname.split('/').at(-1) as string;
      return [
        true,
        null,
        {
          value: {
            application_uid: requestedApplication,
            EDGE_URL: `https://${requestedApplication}.edge.example`,
            jwt: `${requestedApplication}-jwt`,
          },
        },
      ];
    });

    const [configA, configB] = await Promise.all([
      getApplicationConfiguration({ application_uid: appA }),
      getApplicationConfiguration({ application_uid: appB }),
    ]);

    expect(mockMakeRequest).toHaveBeenCalledTimes(2);
    expect(configA).toMatchObject({ application_uid: appA, jwt: 'app-a-jwt' });
    expect(configB).toMatchObject({ application_uid: appB, jwt: 'app-b-jwt' });
  });

  it('does not reuse in-memory configuration across endpoint or environment scopes', async () => {
    mockGetAppConfig.mockResolvedValue(null);
    mockMakeRequest.mockImplementation(async (url: URL) => [
      true,
      null,
      {
        value: {
          application_uid,
          EDGE_URL: `${url.origin}/edge`,
          jwt: `${url.host}-jwt`,
        },
      },
    ]);

    const production = await getApplicationConfiguration({ application_uid });
    mocks.endpoint.gateway = 'https://preview-gateway.zephyr.com/';
    mocks.endpoint.environment = 'preview';
    const preview = await getApplicationConfiguration({ application_uid });

    expect(mockMakeRequest).toHaveBeenCalledTimes(2);
    expect(production.jwt).toBe('gateway.zephyr.com-jwt');
    expect(preview.jwt).toBe('preview-gateway.zephyr.com-jwt');
    expect(mockGetAppConfig).toHaveBeenNthCalledWith(2, application_uid, {
      apiEndpoint: mocks.endpoint.api,
      apiGatewayEndpoint: 'https://preview-gateway.zephyr.com/',
      environment: 'preview',
      preview: false,
      principalFingerprint: expect.any(String),
    });
  });

  it('does not reuse memory, persistence, or single-flight work after a token change', async () => {
    mockGetAppConfig.mockResolvedValue(null);
    mockMakeRequest.mockImplementation(
      async (_url: URL, options: { headers?: Record<string, string> }) => {
        const authorization = options.headers?.['Authorization'];
        const principal = authorization === 'Bearer principal-a' ? 'a' : 'b';
        return [
          true,
          null,
          {
            value: {
              application_uid,
              EDGE_URL: `https://${principal}.edge.example`,
              jwt: `${principal}-config-jwt`,
            },
          },
        ];
      }
    );

    mockGetToken.mockResolvedValue('principal-a');
    const principalA = await getApplicationConfiguration({ application_uid });
    mockGetToken.mockResolvedValue('principal-b');
    const principalB = await getApplicationConfiguration({ application_uid });

    expect(mockMakeRequest).toHaveBeenCalledTimes(2);
    expect(mockGetAppConfig).toHaveBeenCalledTimes(2);
    expect(principalA.jwt).toBe('a-config-jwt');
    expect(principalB.jwt).toBe('b-config-jwt');
    const firstScope = mockGetAppConfig.mock.calls[0]?.[1];
    const secondScope = mockGetAppConfig.mock.calls[1]?.[1];
    expect(firstScope.principalFingerprint).not.toBe(secondScope.principalFingerprint);
    expect(JSON.stringify([firstScope, secondScope])).not.toContain('principal-a');
    expect(JSON.stringify([firstScope, secondScope])).not.toContain('principal-b');
  });

  it('treats preview mode as a separate identity even when endpoints are unchanged', async () => {
    mockGetAppConfig.mockResolvedValue(null);
    mockMakeRequest.mockResolvedValue([
      true,
      null,
      {
        value: {
          application_uid,
          EDGE_URL: 'https://edge.example',
          jwt: 'config-jwt',
        },
      },
    ]);

    await getApplicationConfiguration({ application_uid });
    mocks.endpoint.preview = true;
    await getApplicationConfiguration({ application_uid });

    expect(mockMakeRequest).toHaveBeenCalledTimes(2);
    expect(mockGetAppConfig.mock.calls[0]?.[1]).toMatchObject({ preview: false });
    expect(mockGetAppConfig.mock.calls[1]?.[1]).toMatchObject({ preview: true });
  });

  it('does not reuse a persisted configuration belonging to another application', async () => {
    const requestedApplication = 'app-b';
    mockGetAppConfig.mockResolvedValue({ ...appConfig, application_uid: 'app-a' });
    mockMakeRequest.mockResolvedValue([
      true,
      null,
      {
        value: {
          application_uid: requestedApplication,
          EDGE_URL: 'https://app-b.edge.example',
          jwt: 'app-b-jwt',
        },
      },
    ]);

    const result = await getApplicationConfiguration({
      application_uid: requestedApplication,
    });

    expect(mockMakeRequest).toHaveBeenCalledTimes(1);
    expect(result.application_uid).toBe(requestedApplication);
    expect(result.jwt).toBe('app-b-jwt');
  });

  // Test cache invalidation
  it('should fetch new config after cache invalidation', async () => {
    // First call - sets up the cache
    mockGetAppConfig.mockResolvedValue(appConfig);
    mockIsTokenStillValid.mockReturnValue(true);

    await getApplicationConfiguration({ application_uid });

    // Invalidate cache
    invalidateApplicationConfigCache();

    // Reset mock to verify it's called again
    mockGetAppConfig.mockClear();

    // Second call - should call getAppConfig again
    await getApplicationConfiguration({ application_uid });

    expect(mockGetAppConfig).toHaveBeenCalledTimes(1);
  });
});
