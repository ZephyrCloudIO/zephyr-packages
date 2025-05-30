import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ZephyrEngine, type ZeDependencyPair } from '../index';
import { resolve_remote_dependency } from '../resolve_remote_dependency';

jest.mock('../resolve_remote_dependency');
const mockResolveRemoteDependency = resolve_remote_dependency as jest.MockedFunction<
  typeof resolve_remote_dependency
>;

jest.mock('../../lib/auth/login', () => ({
  checkAuth: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/build-context/ze-util-read-package-json', () => ({
  getPackageJson: jest.fn().mockResolvedValue({
    name: 'test-app',
    version: '1.0.0',
    zephyrDependencies: {
      'mobile-cart': { app_uid: 'mobile-cart', version: '1.0.0' },
      'mobile-cart:ios': { app_uid: 'mobile-cart:ios', version: '1.0.1' },
      'mobile-cart:android': { app_uid: 'mobile-cart:android', version: '1.0.2' },
      'shared-lib.project.org': { app_uid: 'shared-lib.project.org', version: '^2.0.0' },
    },
  }),
}));

jest.mock('../../lib/build-context/ze-util-get-git-info', () => ({
  getGitInfo: jest.fn().mockResolvedValue({
    git: { branch: 'main' },
    app: { org: 'test-org', project: 'test-project' },
  }),
}));

jest.mock('../../lib/edge-requests/get-application-configuration', () => ({
  getApplicationConfiguration: jest.fn().mockResolvedValue({
    username: 'test-user',
    email: 'test@example.com',
    EDGE_URL: 'https://edge.test.com',
    PLATFORM: 'cloudflare',
  }),
}));

jest.mock('../../lib/edge-requests/get-build-id', () => ({
  getBuildId: jest.fn().mockResolvedValue('build-123'),
}));

jest.mock('../../lib/edge-hash-list/distributed-hash-control', () => ({
  get_hash_list: jest.fn().mockResolvedValue({ hash_set: new Set() }),
}));

describe('ZephyrEngine.resolve_remote_dependencies', () => {
  let zephyrEngine: ZephyrEngine;

  beforeEach(async () => {
    jest.clearAllMocks();
    zephyrEngine = await ZephyrEngine.create({ context: '/test', builder: 'webpack' });
  });

  it('should resolve simple dependencies without platform targeting', async () => {
    // Arrange
    const deps: ZeDependencyPair[] = [
      { name: 'mobile-cart', version: '1.0.0' },
      { name: 'shared-lib', version: '^2.0.0' },
    ];

    mockResolveRemoteDependency
      .mockResolvedValueOnce({
        name: 'mobile-cart',
        application_uid: 'mobile-cart.test-project.test-org',
        default_url: 'https://cdn.example.com/mobile-cart/1.0.0',
        remote_entry_url: 'https://cdn.example.com/mobile-cart/1.0.0/remoteEntry.js',
        version: '1.0.0',
      })
      .mockResolvedValueOnce({
        name: 'shared-lib',
        application_uid: 'shared-lib.test-project.test-org',
        default_url: 'https://cdn.example.com/shared-lib/2.1.0',
        remote_entry_url: 'https://cdn.example.com/shared-lib/2.1.0/remoteEntry.js',
        version: '2.1.0',
      });

    // Act
    const result = await zephyrEngine.resolve_remote_dependencies(deps);

    // Assert
    expect(result).toHaveLength(2);
    expect(result?.[0]).toMatchObject({
      name: 'mobile-cart',
      version: '1.0.0',
      default_url: 'https://cdn.example.com/mobile-cart/1.0.0',
    });
    expect(result?.[1]).toMatchObject({
      name: 'shared-lib',
      version: '^2.0.0',
      default_url: 'https://cdn.example.com/shared-lib/2.1.0',
    });
  });

  it('should resolve platform-specific dependencies for iOS', async () => {
    // Arrange
    zephyrEngine.env.target = 'ios';
    const deps: ZeDependencyPair[] = [{ name: 'mobile-cart', version: '1.0.0' }];

    mockResolveRemoteDependency.mockResolvedValueOnce({
      name: 'mobile-cart',
      application_uid: 'mobile-cart.test-project.test-org',
      default_url: 'https://cdn.example.com/mobile-cart-ios/1.0.1',
      remote_entry_url: 'https://cdn.example.com/mobile-cart-ios/1.0.1/remoteEntry.js',
      version: '1.0.1',
    });

    // Act
    const result = await zephyrEngine.resolve_remote_dependencies(deps);

    // Assert
    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({
      name: 'mobile-cart',
      version: '1.0.0',
      default_url: 'https://cdn.example.com/mobile-cart-ios/1.0.1',
    });
  });

  it('should resolve platform-specific dependencies for Android', async () => {
    // Arrange
    zephyrEngine.env.target = 'android';
    const deps: ZeDependencyPair[] = [{ name: 'mobile-cart', version: '1.0.0' }];

    mockResolveRemoteDependency.mockResolvedValueOnce({
      name: 'mobile-cart',
      application_uid: 'mobile-cart.test-project.test-org',
      default_url: 'https://cdn.example.com/mobile-cart-android/1.0.2',
      remote_entry_url:
        'https://cdn.example.com/mobile-cart-android/1.0.2/remoteEntry.js',
      version: '1.0.2',
    });

    // Act
    const result = await zephyrEngine.resolve_remote_dependencies(deps);

    // Assert
    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({
      name: 'mobile-cart',
      version: '1.0.0',
      default_url: 'https://cdn.example.com/mobile-cart-android/1.0.2',
    });
  });

  it('should handle dependencies with full app_uid format', async () => {
    // Arrange
    const deps: ZeDependencyPair[] = [
      { name: 'shared-lib.project.org', version: '^2.0.0' },
    ];

    mockResolveRemoteDependency.mockResolvedValueOnce({
      name: 'shared-lib.project.org',
      application_uid: 'shared-lib.project.org',
      default_url: 'https://cdn.example.com/shared-lib/2.1.0',
      remote_entry_url: 'https://cdn.example.com/shared-lib/2.1.0/remoteEntry.js',
      version: '2.1.0',
    });

    // Act
    const result = await zephyrEngine.resolve_remote_dependencies(deps);

    // Assert
    expect(result).toHaveLength(1);
    expect(mockResolveRemoteDependency).toHaveBeenCalledWith({
      application_uid: 'shared-lib.project.org',
      version: '^2.0.0',
      build_context: expect.any(String),
    });
  });

  it('should handle failed dependency resolution gracefully', async () => {
    // Arrange
    const deps: ZeDependencyPair[] = [
      { name: 'mobile-cart', version: '1.0.0' },
      { name: 'missing-dep', version: '1.0.0' },
    ];

    mockResolveRemoteDependency
      .mockResolvedValueOnce({
        name: 'mobile-cart',
        application_uid: 'mobile-cart.test-project.test-org',
        default_url: 'https://cdn.example.com/mobile-cart/1.0.0',
        remote_entry_url: 'https://cdn.example.com/mobile-cart/1.0.0/remoteEntry.js',
        version: '1.0.0',
      })
      .mockRejectedValueOnce(new Error('Dependency not found'));

    // Act
    const result = await zephyrEngine.resolve_remote_dependencies(deps);

    // Assert
    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({
      name: 'mobile-cart',
    });
  });

  it('should return null for empty dependencies array', async () => {
    // Act
    const result = await zephyrEngine.resolve_remote_dependencies([]);

    // Assert
    expect(result).toBeNull();
  });

  it('should handle dependencies with different name formats', async () => {
    // Arrange
    const deps: ZeDependencyPair[] = [
      { name: 'simple-name', version: '1.0.0' },
      { name: 'namespaced.app.org', version: '2.0.0' },
    ];

    mockResolveRemoteDependency
      .mockResolvedValueOnce({
        name: 'simple-name',
        application_uid: 'simple-name.test-project.test-org',
        default_url: 'https://cdn.example.com/simple-name/1.0.0',
        remote_entry_url: 'https://cdn.example.com/simple-name/1.0.0/remoteEntry.js',
        version: '1.0.0',
        library_type: 'module',
      })
      .mockResolvedValueOnce({
        name: 'namespaced.app.org',
        application_uid: 'namespaced.app.org',
        default_url: 'https://cdn.example.com/namespaced-app/2.0.0',
        remote_entry_url: 'https://cdn.example.com/namespaced-app/2.0.0/remoteEntry.js',
        version: '2.0.0',
        library_type: 'module',
      });

    // Act
    const result = await zephyrEngine.resolve_remote_dependencies(deps);

    // Assert
    expect(result).toHaveLength(2);
    expect(mockResolveRemoteDependency).toHaveBeenNthCalledWith(1, {
      application_uid: 'simple-name.test-project.test-org',
      version: '1.0.0',
      build_context: expect.any(String),
    });
    expect(mockResolveRemoteDependency).toHaveBeenNthCalledWith(2, {
      application_uid: 'namespaced.app.org',
      version: '2.0.0',
      build_context: expect.any(String),
    });
  });

  it('should include build context with correct information', async () => {
    // Arrange
    zephyrEngine.env.target = 'ios';
    const deps: ZeDependencyPair[] = [{ name: 'mobile-cart', version: '1.0.0' }];

    mockResolveRemoteDependency.mockResolvedValueOnce({
      name: 'mobile-cart',
      application_uid: 'mobile-cart.test-project.test-org',
      default_url: 'https://cdn.example.com/mobile-cart/1.0.0',
      remote_entry_url: 'https://cdn.example.com/mobile-cart/1.0.0/remoteEntry.js',
      version: '1.0.0',
    });

    // Act
    await zephyrEngine.resolve_remote_dependencies(deps);

    // Assert
    const [call] = mockResolveRemoteDependency.mock.calls[0];
    const buildContext = JSON.parse(Buffer.from(call.build_context, 'base64').toString());

    expect(buildContext).toMatchObject({
      target: 'ios',
      isCI: expect.any(Boolean),
      branch: 'main',
      username: 'test-user',
    });
  });

  it('should handle dependencies that resolve to different names', async () => {
    // Arrange
    const deps: ZeDependencyPair[] = [{ name: 'local-name', version: '1.0.0' }];

    mockResolveRemoteDependency.mockResolvedValueOnce({
      name: 'remote-name',
      application_uid: 'remote-name.test-project.test-org',
      default_url: 'https://cdn.example.com/remote-name/1.0.0',
      remote_entry_url: 'https://cdn.example.com/remote-name/1.0.0/remoteEntry.js',
      version: '1.0.0',
    });

    // Act
    const result = await zephyrEngine.resolve_remote_dependencies(deps);

    // Assert
    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({
      name: 'local-name',
      version: '1.0.0',
      default_url: 'https://cdn.example.com/remote-name/1.0.0',
    });
  });
});
