import {
  upload_assets_for_engine,
  type UploadAssetsContext,
  type UploadAssetsProps,
} from './upload_assets_for_engine';

// Mock dependencies
jest.mock('is-ci', () => false);
jest.mock('../lib/deployment/get-upload-strategy');
jest.mock('../lib/edge-hash-list/get-missing-assets');
jest.mock('../lib/logging');
jest.mock('../lib/node-persist/app-deploy-result-cache');
jest.mock('../lib/transformers/ze-build-snapshot');
jest.mock('./build_finished_for_engine');

import { getUploadStrategy } from '../lib/deployment/get-upload-strategy';
import { get_missing_assets } from '../lib/edge-hash-list/get-missing-assets';
import { ze_log } from '../lib/logging';
import { createSnapshot } from '../lib/transformers/ze-build-snapshot';
import { build_finished_for_engine } from './build_finished_for_engine';

const mockGetMissingAssets = get_missing_assets as jest.MockedFunction<
  typeof get_missing_assets
>;
const mockCreateSnapshot = createSnapshot as jest.MockedFunction<typeof createSnapshot>;
const mockBuildFinishedForEngine = build_finished_for_engine as jest.MockedFunction<
  typeof build_finished_for_engine
>;

describe('upload_assets_for_engine', () => {
  const mockProps: UploadAssetsProps = {
    assetsMap: { 'app.js': { name: 'app.js', path: '/dist/app.js' } } as any,
    buildStats: { modules: [] } as any,
    mfConfig: undefined,
  };

  const mockContext: UploadAssetsContext = {
    application_uid: 'org.project.app',
    build_id: Promise.resolve('build-123'),
    resolved_hash_list: { hash_set: new Set(['existing-hash']) },
    application_configuration: Promise.resolve({
      PLATFORM: 'cloudflare',
      application_uid: 'test',
      AUTH0_CLIENT_ID: 'test',
      AUTH0_DOMAIN: 'test',
      BUILD_ID_ENDPOINT: 'test',
      EDGE_URL: 'test',
      DELIMITER: 'test',
      email: 'test',
      jwt: 'test',
      user_uuid: 'test',
      username: 'test',
      build_target: 'test',
    } as any),
    version_url: null,
    logger: Promise.resolve(jest.fn()),
    build_start_time: Date.now() - 5000,
    federated_dependencies: [],
    env: { target: 'web' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should upload assets successfully', async () => {
    const mockMissingAssets = [{ name: 'app.js', path: '/dist/app.js' }];
    const mockSnapshot = { id: 'snapshot-123' };
    const mockVersionUrl = 'https://example.com/app';
    const mockStrategy = jest.fn().mockResolvedValue(mockVersionUrl);

    mockGetMissingAssets.mockReturnValue(mockMissingAssets as any);
    mockCreateSnapshot.mockResolvedValue(mockSnapshot as any);
    (getUploadStrategy as jest.MockedFunction<typeof getUploadStrategy>).mockReturnValue(
      mockStrategy
    );

    const result = await upload_assets_for_engine(mockProps, mockContext);

    expect(mockGetMissingAssets).toHaveBeenCalledWith({
      assetsMap: mockProps.assetsMap,
      hash_set: { hash_set: new Set(['existing-hash']) },
    });

    expect(mockCreateSnapshot).toHaveBeenCalledWith(mockContext, {
      assets: mockProps.assetsMap,
      mfConfig: mockProps.mfConfig,
    });

    expect(getUploadStrategy).toHaveBeenCalledWith('cloudflare');
    expect(mockStrategy).toHaveBeenCalledWith(mockContext, {
      snapshot: mockSnapshot,
      getDashData: expect.any(Function),
      assets: {
        assetsMap: mockProps.assetsMap,
        missingAssets: mockMissingAssets,
      },
    });

    expect(mockBuildFinishedForEngine).toHaveBeenCalledWith({
      logger: mockContext.logger,
      build_start_time: mockContext.build_start_time,
      version_url: mockVersionUrl,
      federated_dependencies: mockContext.federated_dependencies,
      env: mockContext.env,
    });

    expect(result).toBe(mockVersionUrl);
  });

  it('should return null when application_uid is missing', async () => {
    const contextWithoutUid = { ...mockContext, application_uid: '' };

    const result = await upload_assets_for_engine(mockProps, contextWithoutUid);

    expect(ze_log).toHaveBeenCalledWith(
      'Failed to upload assets: missing application_uid or build_id'
    );
    expect(result).toBeNull();
    expect(mockGetMissingAssets).not.toHaveBeenCalled();
  });

  it('should return null when build_id is missing', async () => {
    const contextWithoutBuildId = { ...mockContext, build_id: null };

    const result = await upload_assets_for_engine(mockProps, contextWithoutBuildId);

    expect(ze_log).toHaveBeenCalledWith(
      'Failed to upload assets: missing application_uid or build_id'
    );
    expect(result).toBeNull();
    expect(mockGetMissingAssets).not.toHaveBeenCalled();
  });

  it('should use empty hash set when resolved_hash_list is null', async () => {
    const contextWithoutHashList = { ...mockContext, resolved_hash_list: null };
    const mockMissingAssets = [{ name: 'app.js', path: '/dist/app.js' }];
    const mockSnapshot = { id: 'snapshot-123' };
    const mockVersionUrl = 'https://example.com/app';
    const mockStrategy = jest.fn().mockResolvedValue(mockVersionUrl);

    mockGetMissingAssets.mockReturnValue(mockMissingAssets as any);
    mockCreateSnapshot.mockResolvedValue(mockSnapshot as any);
    (getUploadStrategy as jest.MockedFunction<typeof getUploadStrategy>).mockReturnValue(
      mockStrategy
    );

    await upload_assets_for_engine(mockProps, contextWithoutHashList);

    expect(mockGetMissingAssets).toHaveBeenCalledWith({
      assetsMap: mockProps.assetsMap,
      hash_set: { hash_set: new Set() },
    });
  });

  it('should call getDashData function correctly', async () => {
    const mockMissingAssets = [{ name: 'app.js', path: '/dist/app.js' }];
    const mockSnapshot = { id: 'snapshot-123' };
    const mockVersionUrl = 'https://example.com/app';
    const mockStrategy = jest.fn().mockResolvedValue(mockVersionUrl);

    mockGetMissingAssets.mockReturnValue(mockMissingAssets as any);
    mockCreateSnapshot.mockResolvedValue(mockSnapshot as any);
    (getUploadStrategy as jest.MockedFunction<typeof getUploadStrategy>).mockReturnValue(
      mockStrategy
    );

    await upload_assets_for_engine(mockProps, mockContext);

    const strategyCall = mockStrategy.mock.calls[0];
    const uploadOptions = strategyCall[1];

    expect(uploadOptions.getDashData()).toBe(mockProps.buildStats);
  });
});

describe('upload_assets_for_engine CI behavior', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should save deploy result when in CI environment', async () => {
    // Mock isCI to return true by requiring the module with mocked isCI
    jest.doMock('is-ci', () => true);
    jest.doMock('../lib/node-persist/app-deploy-result-cache', () => ({
      setAppDeployResult: jest.fn(),
    }));
    jest.doMock('../lib/deployment/get-upload-strategy', () => ({
      getUploadStrategy: jest.fn(),
    }));

    // Re-import the module after mocking
    const { upload_assets_for_engine } = await import('./upload_assets_for_engine');
    const { setAppDeployResult } = await import(
      '../lib/node-persist/app-deploy-result-cache'
    );
    const { getUploadStrategy } = await import('../lib/deployment/get-upload-strategy');

    const mockMissingAssets = [{ name: 'app.js', path: '/dist/app.js' }];
    const mockSnapshot = { id: 'snapshot-123' };
    const mockVersionUrl = 'https://example.com/app';
    const mockStrategy = jest.fn().mockResolvedValue(mockVersionUrl);

    mockGetMissingAssets.mockReturnValue(mockMissingAssets as any);
    mockCreateSnapshot.mockResolvedValue(mockSnapshot as any);
    (getUploadStrategy as jest.MockedFunction<typeof getUploadStrategy>).mockReturnValue(
      mockStrategy
    );

    const mockProps: UploadAssetsProps = {
      assetsMap: { 'app.js': { name: 'app.js', path: '/dist/app.js' } } as any,
      buildStats: { modules: [] } as any,
    };

    const mockContext: UploadAssetsContext = {
      application_uid: 'org.project.app',
      build_id: Promise.resolve('build-123'),
      resolved_hash_list: { hash_set: new Set(['existing-hash']) },
      application_configuration: Promise.resolve({
        PLATFORM: 'cloudflare',
        application_uid: 'test',
        AUTH0_CLIENT_ID: 'test',
        AUTH0_DOMAIN: 'test',
        BUILD_ID_ENDPOINT: 'test',
        EDGE_URL: 'test',
        DELIMITER: 'test',
        email: 'test',
        jwt: 'test',
        user_uuid: 'test',
        username: 'test',
        build_target: 'test',
      } as any),
      version_url: null,
      logger: Promise.resolve(jest.fn()),
      build_start_time: Date.now() - 5000,
      federated_dependencies: [],
      env: { target: 'web' },
    };

    await upload_assets_for_engine(mockProps, mockContext);

    expect(setAppDeployResult).toHaveBeenCalledWith('org.project.app', {
      urls: [mockVersionUrl],
    });
  });
});
