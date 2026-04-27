import { rs } from '@rstest/core';
import * as loginModule from '../auth/login';
import * as httpRequestModule from '../http/http-request';
import * as appConfigPersistModule from '../node-persist/application-configuration';
import * as tokenModule from '../node-persist/token';
import {
  getApplicationConfiguration,
  invalidateApplicationConfigCache,
} from './get-application-configuration';

const jest = rs;

const mockMakeRequest = jest.spyOn(httpRequestModule, 'makeRequest');
const mockGetToken = jest.spyOn(tokenModule, 'getToken');
const mockIsTokenStillValid = jest.spyOn(loginModule, 'isTokenStillValid');
const mockGetAppConfig = jest.spyOn(appConfigPersistModule, 'getAppConfig');
const mockSaveAppConfig = jest.spyOn(appConfigPersistModule, 'saveAppConfig');

describe('getApplicationConfiguration', () => {
  const application_uid = 'test-app-123';
  const token = 'test-jwt-token';
  const appConfig = {
    application_uid,
    EDGE_URL: 'https://edge.zephyr.com',
    jwt: token,
    fetched_at: Date.now(),
    user_uuid: 'user-123',
    username: 'test-user',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateApplicationConfigCache();

    mockGetToken.mockResolvedValue(token);
    mockIsTokenStillValid.mockReturnValue(true);
    mockSaveAppConfig.mockResolvedValue(undefined);
  });

  it('should return stored config when available and token is valid', async () => {
    mockGetAppConfig.mockResolvedValue(appConfig);

    const result = await getApplicationConfiguration({ application_uid });

    expect(result).toEqual(appConfig);
    expect(mockGetAppConfig).toHaveBeenCalledWith(application_uid);
    expect(mockIsTokenStillValid).toHaveBeenCalledWith(token);
    expect(mockMakeRequest).not.toHaveBeenCalled();
  });

  it('should fetch new config when no stored config exists', async () => {
    mockGetAppConfig.mockResolvedValue(null);

    const newConfig = {
      application_uid,
      EDGE_URL: 'https://edge.zephyr.com',
      jwt: 'new-jwt-token',
    };

    mockMakeRequest.mockResolvedValue([true, null, { value: newConfig }]);

    const result = await getApplicationConfiguration({ application_uid });

    expect(mockMakeRequest).toHaveBeenCalledTimes(1);
    expect(mockSaveAppConfig).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject(newConfig);
  });

  it('should use cached config and not call getAppConfig again', async () => {
    mockGetAppConfig.mockResolvedValue(appConfig);

    await getApplicationConfiguration({ application_uid });

    mockGetAppConfig.mockClear();

    const result = await getApplicationConfiguration({ application_uid });

    expect(result).toEqual(appConfig);
    expect(mockGetAppConfig).not.toHaveBeenCalled();
  });

  it('should handle parallel requests by returning the same promise', async () => {
    mockGetAppConfig.mockResolvedValue(null);

    const newConfig = {
      application_uid,
      EDGE_URL: 'https://edge.zephyr.com',
      jwt: 'new-jwt-token',
    };

    mockMakeRequest.mockResolvedValue([true, null, { value: newConfig }]);

    const promises = [
      getApplicationConfiguration({ application_uid }),
      getApplicationConfiguration({ application_uid }),
      getApplicationConfiguration({ application_uid }),
    ];

    const results = await Promise.all(promises);

    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(mockMakeRequest).toHaveBeenCalledTimes(1);
  });

  it('should fetch new config after cache invalidation', async () => {
    mockGetAppConfig.mockResolvedValue(appConfig);

    await getApplicationConfiguration({ application_uid });

    invalidateApplicationConfigCache();
    mockGetAppConfig.mockClear();

    await getApplicationConfiguration({ application_uid });

    expect(mockGetAppConfig).toHaveBeenCalledTimes(1);
  });
});
