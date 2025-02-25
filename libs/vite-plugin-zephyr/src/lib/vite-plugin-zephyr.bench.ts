import { bench, describe, vi, beforeEach } from 'vitest';
import { withZephyr } from './vite-plugin-zephyr';

// Mock dependencies
const mockModuleFederation = {
  federation: vi.fn().mockReturnValue([{ name: 'module-federation' }]),
};

const mockDefer = {
  zephyr_engine_defer: Promise.resolve({
    resolve_remote_dependencies: vi.fn().mockResolvedValue([]),
    start_new_build: vi.fn().mockResolvedValue(undefined),
    upload_assets: vi.fn().mockResolvedValue(undefined),
    build_finished: vi.fn().mockResolvedValue(undefined),
  }),
  zephyr_defer_create: vi.fn(),
};

const mockZephyrAgent = {
  ZephyrEngine: {
    defer_create: vi.fn().mockReturnValue(mockDefer),
  },
  zeBuildDashData: vi.fn().mockResolvedValue({}),
};

const mockExtractRemotes = {
  extract_remotes_dependencies: vi.fn(),
};

const mockLoadRemotes = {
  load_resolved_remotes: vi.fn().mockReturnValue('modified code'),
};

const mockExtractAssets = {
  extract_vite_assets_map: vi.fn().mockResolvedValue({ 'test.js': 'content' }),
};

vi.mock('@module-federation/vite', () => mockModuleFederation);
vi.mock('zephyr-agent', () => mockZephyrAgent);
vi.mock('./internal/mf-vite-etl/extract-mf-vite-remotes', () => mockExtractRemotes);
vi.mock('./internal/mf-vite-etl/load_resolved_remotes', () => mockLoadRemotes);
vi.mock('./internal/extract/extract_vite_assets_map', () => mockExtractAssets);

describe('vite-plugin-zephyr Performance', () => {
  bench('Plugin creation', () => {
    withZephyr();
  });

  bench('Create with module federation config', () => {
    withZephyr({ mfConfig: { name: 'host', remotes: {} } });
  });

  describe('Plugin Hooks', () => {
    let plugin: any;

    beforeEach(() => {
      const plugins = withZephyr();
      plugin = plugins[plugins.length - 1];
      mockExtractRemotes.extract_remotes_dependencies.mockReturnValue([
        { importSpecifier: 'foo', packageName: 'foo' },
      ]);
    });

    bench('configResolved hook', async () => {
      const config = {
        root: '/project/root',
        build: { outDir: 'dist' },
        publicDir: 'public',
      };

      // Just benchmark the hook call itself, not waiting for promises
      plugin.configResolved(config);
    });

    bench('transform hook with dependencies', () => {
      // Just benchmark the hook call itself, not waiting for promises
      plugin.transform('const foo = "bar"', 'index.js');
    });

    bench('transform hook without dependencies', () => {
      mockExtractRemotes.extract_remotes_dependencies.mockReturnValue(null);
      // Just benchmark the hook call itself, not waiting for promises
      plugin.transform('const foo = "bar"', 'index.js');
    });
  });
});
