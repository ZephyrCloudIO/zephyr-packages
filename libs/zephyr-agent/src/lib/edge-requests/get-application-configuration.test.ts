import { isTokenStillValid } from '../auth/login';
import * as httpRequest from '../http/http-request';
import { getAppConfig, saveAppConfig } from '../node-persist/application-configuration';
import { getToken } from '../node-persist/token';
import { getApplicationConfiguration } from './get-application-configuration';

// Mock dependencies
jest.mock('../http/http-request');
jest.mock('../node-persist/token');
jest.mock('../auth/login');
jest.mock('../node-persist/application-configuration');
jest.mock('../logging', () => ({
  ze_log: jest.fn(),
}));
jest.mock('zephyr-edge-contract', () => ({
  ZE_API_ENDPOINT: jest.fn(() => 'https://api.zephyr.com'),
  ze_api_gateway: {
    application_config: '/api/v1/application-config',
  },
}));

// Simplified test to ensure basic functionality works
describe('getApplicationConfiguration', () => {
  // Create mocks
  const mockMakeRequest = jest.spyOn(httpRequest, 'makeRequest');
  const mockGetToken = getToken as jest.Mock;
  const mockIsTokenStillValid = isTokenStillValid as jest.Mock;
  const mockGetAppConfig = getAppConfig as jest.Mock;
  const mockSaveAppConfig = saveAppConfig as jest.Mock;

  // Test data
  const application_uid = 'test-app-123';
  const token = 'test-jwt-token';
  const appConfig = {
    EDGE_URL: 'https://edge.zephyr.com',
    jwt: token,
    fetched_at: Date.now(), // Current time
    user_uuid: 'user-123',
    username: 'test-user',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue(token);
  });

  // Simple test that cached config is returned when available and valid
  it('should return cached config when available and token is valid', async () => {
    mockGetAppConfig.mockResolvedValue(appConfig);
    mockIsTokenStillValid.mockReturnValue(true);

    const result = await getApplicationConfiguration({ application_uid });

    expect(result).toEqual(appConfig);
    expect(mockGetAppConfig).toHaveBeenCalledWith(application_uid);
    expect(mockIsTokenStillValid).toHaveBeenCalledWith(token);
    expect(mockMakeRequest).not.toHaveBeenCalled();
  });

  // Simple test to verify a successful fetch of new app config
  it('should fetch new config when no cached config exists', async () => {
    // Mock no cached config
    mockGetAppConfig.mockResolvedValue(null);

    // Mock API response
    const newConfig = {
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
});
