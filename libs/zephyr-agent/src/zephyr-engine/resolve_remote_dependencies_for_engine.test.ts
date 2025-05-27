import {
  resolve_remote_dependencies_for_engine,
  type ResolveRemoteDependenciesContext,
} from './resolve_remote_dependencies_for_engine';
import type { ZeDependencyPair } from './is_zephyr_dependency_pair';

// Mock dependencies
jest.mock('zephyr-edge-contract', () => ({
  ZeUtils: {
    PromiseTuple: jest.fn(),
    isSuccessTuple: jest.fn(),
  },
  createApplicationUid: jest.fn(),
}));

jest.mock('../lib/logging', () => ({
  ze_log: jest.fn(),
}));

jest.mock('./resolve_remote_dependency', () => ({
  resolve_remote_dependency: jest.fn(),
}));

jest.mock('./is_zephyr_resolved_dependency', () => ({
  is_zephyr_resolved_dependency: jest.fn(),
}));

import { ZeUtils, createApplicationUid } from 'zephyr-edge-contract';
import { ze_log } from '../lib/logging';
import { resolve_remote_dependency } from './resolve_remote_dependency';
import { is_zephyr_resolved_dependency } from './is_zephyr_resolved_dependency';

const mockZeUtils = ZeUtils as jest.Mocked<typeof ZeUtils>;
const mockCreateApplicationUid = createApplicationUid as jest.MockedFunction<
  typeof createApplicationUid
>;
const mockResolveRemoteDependency = resolve_remote_dependency as jest.MockedFunction<
  typeof resolve_remote_dependency
>;
const mockIsZephyrResolvedDependency =
  is_zephyr_resolved_dependency as jest.MockedFunction<
    typeof is_zephyr_resolved_dependency
  >;

describe('resolve_remote_dependencies_for_engine', () => {
  const mockContext: ResolveRemoteDependenciesContext = {
    npmProperties: {
      zephyrDependencies: {
        '@org/app1': { app_uid: 'my-org.my-project.app1', version: '1.0.0' },
      },
    },
    env: { target: 'web' },
    gitProperties: {
      app: { org: 'default-org', project: 'default-project' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when deps is falsy', async () => {
    const result = await resolve_remote_dependencies_for_engine(null as any, mockContext);
    expect(result).toBeNull();
  });

  it('should resolve dependencies successfully', async () => {
    const deps: ZeDependencyPair[] = [{ name: '@org/app1', version: '1.0.0' }];

    const mockResolvedDep = {
      name: '@org/app1',
      version: '1.0.0',
      default_url: 'https://example.com/remoteEntry.js',
    };

    mockCreateApplicationUid.mockReturnValue('my-org.my-project.app1');
    mockZeUtils.PromiseTuple.mockResolvedValue([null, mockResolvedDep]);
    mockZeUtils.isSuccessTuple.mockReturnValue(true);
    mockIsZephyrResolvedDependency.mockReturnValue(true);

    const result = await resolve_remote_dependencies_for_engine(deps, mockContext);

    // ze_dependency.app_uid = 'my-org.my-project.app1' splits to ['my-org', 'my-project', 'app1']
    // ze_app_name = 'my-org', ze_project_name = 'my-project', ze_org_name = 'app1'
    expect(mockCreateApplicationUid).toHaveBeenCalledWith({
      org: 'app1', // ze_org_name
      project: 'my-project', // ze_project_name
      name: 'my-org', // ze_app_name
    });
    expect(mockResolveRemoteDependency).toHaveBeenCalledWith({
      application_uid: 'my-org.my-project.app1',
      version: '1.0.0',
      platform: 'web',
    });
    expect(result).toEqual([mockResolvedDep]);
  });

  it('should handle failed dependency resolution', async () => {
    const deps: ZeDependencyPair[] = [{ name: '@org/app1', version: '1.0.0' }];

    mockCreateApplicationUid.mockReturnValue('my-org.my-project.app1');
    mockZeUtils.PromiseTuple.mockResolvedValue(['error', null]);
    mockZeUtils.isSuccessTuple.mockReturnValue(false);
    mockIsZephyrResolvedDependency.mockReturnValue(false);

    const result = await resolve_remote_dependencies_for_engine(deps, mockContext);

    expect(ze_log).toHaveBeenCalledWith(
      'Failed to resolve remote dependency: @org/app1@1.0.0',
      'skipping...'
    );
    expect(result).toEqual([]);
  });

  it('should use fallback values when zephyr dependency config is missing', async () => {
    const deps: ZeDependencyPair[] = [{ name: 'org.project.app2', version: '2.0.0' }];

    const contextWithoutZeDeps = {
      ...mockContext,
      npmProperties: { zephyrDependencies: undefined },
    };

    const mockResolvedDep = {
      name: 'org.project.app2',
      version: '2.0.0',
      default_url: 'https://example.com/remoteEntry.js',
    };

    mockCreateApplicationUid.mockReturnValue('org.project.app2');
    mockZeUtils.PromiseTuple.mockResolvedValue([null, mockResolvedDep]);
    mockZeUtils.isSuccessTuple.mockReturnValue(true);
    mockIsZephyrResolvedDependency.mockReturnValue(true);

    const result = await resolve_remote_dependencies_for_engine(
      deps,
      contextWithoutZeDeps
    );

    // org.project.app2 splits by '.' to ['org', 'project', 'app2']
    // app_name = 'org', project_name = 'project', org_name = 'app2'
    expect(mockCreateApplicationUid).toHaveBeenCalledWith({
      org: 'app2', // org_name
      project: 'project', // project_name
      name: 'org', // app_name
    });
    expect(result).toEqual([mockResolvedDep]);
  });

  it('should map dependency name when resolved name differs', async () => {
    const deps: ZeDependencyPair[] = [{ name: '@org/app1', version: '1.0.0' }];

    const mockResolvedDep = {
      name: 'different-name',
      version: '1.0.0',
      default_url: 'https://example.com/remoteEntry.js',
    };

    const expectedMappedDep = {
      name: '@org/app1',
      version: '1.0.0',
      default_url: 'https://example.com/remoteEntry.js',
    };

    mockCreateApplicationUid.mockReturnValue('my-org.my-project.app1');
    mockZeUtils.PromiseTuple.mockResolvedValue([null, mockResolvedDep]);
    mockZeUtils.isSuccessTuple.mockReturnValue(true);
    mockIsZephyrResolvedDependency.mockReturnValue(true);

    const result = await resolve_remote_dependencies_for_engine(deps, mockContext);

    expect(result).toEqual([expectedMappedDep]);
  });
});
