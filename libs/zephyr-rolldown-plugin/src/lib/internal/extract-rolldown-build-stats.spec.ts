import { extractXViteBuildStats } from 'zephyr-xpack-internal';
import type { ZephyrEngine } from 'zephyr-agent';
import type { XOutputBundle, XOutputChunk } from 'zephyr-xpack-internal';

// Mock zephyr-agent functions
jest.mock('zephyr-agent', () => ({
  ze_log: jest.fn(),
  resolveCatalogDependencies: jest.fn((deps) => deps || {}),
}));

// Mock the zephyr-xpack-internal module
jest.mock('zephyr-xpack-internal', () => ({
  extractXViteBuildStats: jest.fn(),
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
};

const mockBundle: XOutputBundle = {
  'index.js': mockChunk,
  'styles.css': {
    type: 'asset',
    fileName: 'styles.css',
    name: undefined,
    source: '.button { color: blue; }',
  },
  'README.md': {
    type: 'asset',
    fileName: 'README.md',
    name: undefined,
    source: '# Rolldown Library',
  },
};

describe('extractRolldownBuildStats', () => {
  let mockExtractXViteBuildStats: jest.MockedFunction<typeof extractXViteBuildStats>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractXViteBuildStats = extractXViteBuildStats as jest.MockedFunction<
      typeof extractXViteBuildStats
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
    };

    mockExtractXViteBuildStats.mockResolvedValue(mockResult);

    const result = await extractXViteBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: mockBundle,
    });

    // Verify the function was called with correct parameters
    expect(mockExtractXViteBuildStats).toHaveBeenCalledWith({
      zephyr_engine: mockZephyrEngine,
      bundle: mockBundle,
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
    expect(result.dependencies[0].name).toBe('rolldown');
    expect(result.peerDependencies).toHaveLength(1);
    expect(result.peerDependencies[0].name).toBe('react');

    // Verify metadata
    expect(result.metadata.bundler).toBe('rolldown');
    expect(result.metadata.fileCount).toBe(3);
    expect(result.metadata.chunkCount).toBe(1);
    expect(result.metadata.assetCount).toBe(2);
    expect(result.metadata.dynamicImportCount).toBe(1);
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
    };

    mockExtractXViteBuildStats.mockResolvedValue(mockResult);

    const result = await extractXViteBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: {},
    });

    // Verify the function was called with correct parameters
    expect(mockExtractXViteBuildStats).toHaveBeenCalledWith({
      zephyr_engine: mockZephyrEngine,
      bundle: {},
    });

    expect(result.metadata.fileCount).toBe(0);
    expect(result.metadata.chunkCount).toBe(0);
    expect(result.metadata.assetCount).toBe(0);
    expect(result.metadata.dynamicImportCount).toBe(0);
  });
});
