import { bench, describe } from 'vitest';
import { withZephyr } from './vite-plugin-zephyr';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';

// Mock dependencies
jest.mock('@module-federation/vite', () => ({
  federation: jest.fn().mockReturnValue([{ name: 'module-federation' }]),
}));

jest.mock('zephyr-agent', () => {
  const mockDefer = {
    zephyr_engine_defer: Promise.resolve({
      resolve_remote_dependencies: jest.fn().mockResolvedValue([]),
      start_new_build: jest.fn().mockResolvedValue(undefined),
      upload_assets: jest.fn().mockResolvedValue(undefined),
      build_finished: jest.fn().mockResolvedValue(undefined),
    }),
    zephyr_defer_create: jest.fn(),
  };

  return {
    ZephyrEngine: {
      defer_create: jest.fn().mockReturnValue(mockDefer),
    },
    zeBuildDashData: jest.fn().mockResolvedValue({}),
  };
});

jest.mock('./internal/mf-vite-etl/extract-mf-vite-remotes', () => ({
  extract_remotes_dependencies: jest.fn(),
}));

jest.mock('./internal/mf-vite-etl/load_resolved_remotes', () => ({
  load_resolved_remotes: jest.fn().mockReturnValue('modified code'),
}));

jest.mock('./internal/extract/extract_vite_assets_map', () => ({
  extract_vite_assets_map: jest.fn().mockResolvedValue({ 'test.js': 'content' }),
}));

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
      (extract_remotes_dependencies as jest.Mock).mockReturnValue([
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
      (extract_remotes_dependencies as jest.Mock).mockReturnValue(null);
      // Just benchmark the hook call itself, not waiting for promises
      plugin.transform('const foo = "bar"', 'index.js');
    });
  });
});
