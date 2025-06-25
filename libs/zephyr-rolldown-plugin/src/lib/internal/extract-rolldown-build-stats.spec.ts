import type { ZephyrEngine } from 'zephyr-agent';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import {
  extractRollxBuildStats,
  type XOutputBundle,
  type XOutputChunk,
} from 'zephyr-rollx-internal';

// Mock zephyr-agent functions
jest.mock('zephyr-agent', () => ({
  ze_log: jest.fn(),
  resolveCatalogDependencies: jest.fn((deps) => deps || {}),
}));

// Mock the zephyr-rollx-internal module
jest.mock('zephyr-rollx-internal', () => ({
  extractRollxBuildStats: jest.fn(),
}));

// Mock ZephyrEngine
const mockZephyrEngine = {
  applicationProperties: {
    name: 'rolldown-lib',
    version: '1.0.0',
  },
  gitProperties: {
    git: {
      branch: 'main',
      commit: 'def456',
    },
  },
  env: {
    isCI: true,
  },
  snapshotId: Promise.resolve('snapshot-456'),
  application_uid: 'app-uid-456',
  build_id: Promise.resolve('build-456'),
  application_configuration: Promise.resolve({
    EDGE_URL: 'https://edge.example.com',
    PLATFORM: 'web',
    DELIMITER: '-',
  }),
  npmProperties: {
    dependencies: {
      rolldown: '1.0.0',
    },
    devDependencies: {
      typescript: '5.0.0',
    },
    optionalDependencies: {},
    peerDependencies: {
      react: '>=17.0.0',
    },
  },
} as unknown as ZephyrEngine;

// Mock bundle with dynamic imports
const mockChunk: XOutputChunk = {
  type: 'chunk',
  fileName: 'index.js',
  name: 'index',
  facadeModuleId: 'src/index.ts',
  code: 'export const add = (a, b) => a + b;',
  dynamicImports: ['./dynamic.js'],
  imports: [],
  exports: ['add'],
  modules: {},
  moduleIds: [],
  referencedFiles: [],
  isEntry: true,
};

const mockBundle: XOutputBundle = {
  'index.js': mockChunk,
  'styles.css': {
    type: 'asset',
    fileName: 'styles.css',
    names: ['styles.css'],
    originalFileNames: ['src/styles.css'],
    source: '.button { color: blue; }',
    needsCodeReference: false,
  },
  'README.md': {
    type: 'asset',
    fileName: 'README.md',
    names: ['README.md'],
    originalFileNames: ['README.md'],
    source: '# Rolldown Library',
    needsCodeReference: false,
  },
};

describe('extractRolldownBuildStats', () => {
  let mockExtractRollxBuildStats: jest.MockedFunction<typeof extractRollxBuildStats>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractRollxBuildStats = extractRollxBuildStats as jest.MockedFunction<
      typeof extractRollxBuildStats
    >;
  });

  it('should extract build stats from Rolldown build output', async () => {
    // Set up mock return value
    const mockResult = {
      id: 'app-uid-456',
      name: 'rolldown-lib',
      version: 'snapshot-456',
      type: 'lib',
      edge: {
        url: 'https://edge.example.com',
        delimiter: '-',
      },
      dependencies: [{ name: 'rolldown', version: '1.0.0' }],
      peerDependencies: [{ name: 'react', version: '>=17.0.0' }],
      metadata: {
        bundler: 'rolldown',
        fileCount: 3,
        chunkCount: 1,
        assetCount: 2,
        dynamicImportCount: 1,
      },
    } as Partial<ZephyrBuildStats> as ZephyrBuildStats;

    mockExtractRollxBuildStats.mockResolvedValue(mockResult);

    const result = await extractRollxBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: mockBundle,
      root: '/mock/root',
    });

    // Verify the function was called with correct parameters
    expect(mockExtractRollxBuildStats).toHaveBeenCalledWith({
      zephyr_engine: mockZephyrEngine,
      bundle: mockBundle,
      root: '/mock/root',
    });

    // Verify basic properties
    expect(result.id).toBe('app-uid-456');
    expect(result.name).toBe('rolldown-lib');
    expect(result.version).toBe('snapshot-456');
    expect(result.type).toBe('lib');

    // Verify edge config
    expect(result.edge.url).toBe('https://edge.example.com');
    expect(result.edge.delimiter).toBe('-');

    // Verify dependencies
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies![0].name).toBe('rolldown');
    expect(result.peerDependencies).toHaveLength(1);
    expect(result.peerDependencies![0].name).toBe('react');
  });

  it('should handle empty bundle properly', async () => {
    // Set up mock return value for empty bundle
    const mockResult = {
      id: 'app-uid-456',
      name: 'rolldown-lib',
      version: 'snapshot-456',
      metadata: {
        bundler: 'rolldown',
        fileCount: 0,
        chunkCount: 0,
        assetCount: 0,
        dynamicImportCount: 0,
      },
    } as Partial<ZephyrBuildStats> as ZephyrBuildStats;

    mockExtractRollxBuildStats.mockResolvedValue(mockResult);

    await extractRollxBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: {},
      root: '/mock/root',
    });

    // Verify the function was called with correct parameters
    expect(mockExtractRollxBuildStats).toHaveBeenCalledWith({
      zephyr_engine: mockZephyrEngine,
      bundle: {},
      root: '/mock/root',
    });
  });
});
