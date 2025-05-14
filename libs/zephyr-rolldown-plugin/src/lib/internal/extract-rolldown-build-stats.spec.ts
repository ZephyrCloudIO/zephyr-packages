import { extractRolldownBuildStats } from './extract-rolldown-build-stats';
import type { ZephyrEngine } from 'zephyr-agent';
import type { OutputBundle, OutputChunk } from 'rolldown';

// Mock zephyr-agent functions
jest.mock('zephyr-agent', () => ({
  ze_log: jest.fn(),
  resolveCatalogDependencies: jest.fn((deps) => deps || {}),
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
const mockChunk: OutputChunk = {
  type: 'chunk',
  fileName: 'index.js',
  name: 'index',
  facadeModuleId: 'src/index.ts',
  code: 'export const add = (a, b) => a + b;',
  dynamicImports: ['./dynamic.js'],
  imports: [],
  exports: ['add'],
  modules: {},
  referencedFiles: [],
};

const mockBundle: OutputBundle = {
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
  it('should extract build stats from Rolldown build output', async () => {
    const result = await extractRolldownBuildStats({
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
    const result = await extractRolldownBuildStats({
      zephyr_engine: mockZephyrEngine,
      bundle: {},
    });

    expect(result.metadata.fileCount).toBe(0);
    expect(result.metadata.chunkCount).toBe(0);
    expect(result.metadata.assetCount).toBe(0);
    expect(result.metadata.dynamicImportCount).toBe(0);
  });
});
