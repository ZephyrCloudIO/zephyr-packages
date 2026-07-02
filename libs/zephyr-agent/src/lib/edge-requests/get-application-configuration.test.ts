import { rs, type Mock } from '@rstest/core';
import { isTokenStillValid } from '../auth/login';
import * as httpRequest from '../http/http-request';
import { getAppConfig, saveAppConfig } from '../node-persist/application-configuration';
import { getToken } from '../node-persist/token';
import {
  getApplicationConfiguration,
  invalidateApplicationConfigCache,
} from './get-application-configuration';

// Mock dependencies
// Note: explicit factories (instead of `{ mock: true }` automocks) are
// required here because automocks eagerly load the original module graph,
// which is circular (token -> errors -> ze-log-event ->
// get-application-configuration -> token) and would cache the module under
// test with unmocked bindings.
rs.mock('../http/http-request', () => ({
  makeRequest: rs.fn(),
  makeHttpRequest: rs.fn(),
  parseUrl: rs.fn(),
  unwrapResponse: rs.fn(),
}));
rs.mock('../node-persist/token', () => ({
  saveToken: rs.fn(),
  getToken: rs.fn(),
  removeToken: rs.fn(),
  cleanTokens: rs.fn(),
}));
rs.mock('../auth/login', () => ({
  checkAuth: rs.fn(),
  isTokenStillValid: rs.fn(),
}));
rs.mock('../node-persist/application-configuration', () => ({
  saveAppConfig: rs.fn(),
  getAppConfig: rs.fn(),
  removeAppConfig: rs.fn(),
}));
rs.mock('../logging', () => ({ ze_log: { app: rs.fn() } }));
rs.mock('zephyr-edge-contract', () => ({
  ZE_API_ENDPOINT: rs.fn(() => 'https://api.zephyr.com'),
  ze_api_gateway: {
    application_config: '/api/v1/application-config',
  },
}));

// Simplified test to ensure basic functionality works
describe('getApplicationConfiguration', () => {
  // Create mocks
  const mockMakeRequest = httpRequest.makeRequest as Mock<typeof httpRequest.makeRequest>;
  const mockGetToken = getToken as Mock;
  const mockIsTokenStillValid = isTokenStillValid as Mock;
  const mockGetAppConfig = getAppConfig as Mock;
  const mockSaveAppConfig = saveAppConfig as Mock;

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
    expect(mockGetAppConfig).toHaveBeenCalledWith(application_uid);
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
