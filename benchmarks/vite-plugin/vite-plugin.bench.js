import { bench, describe } from 'vitest';

// Mock the withZephyr function
function mockWithZephyr(options) {
  const plugin = {
    name: 'vite-plugin-zephyr',
    configResolved: (config) => {
      // Do minimal work for benchmarking
      return config;
    },
    transform: (code, id) => {
      // Do minimal work for benchmarking
      return null;
    },
  };

  return [plugin];
}

describe('vite-plugin-zephyr Performance', () => {
  bench('Plugin creation', () => {
    mockWithZephyr();
  });

  bench('Create with module federation config', () => {
    mockWithZephyr({ mfConfig: { name: 'host', remotes: {} } });
  });

  describe('Plugin Hooks', () => {
    // Initialize plugin once for all benchmarks
    const plugins = mockWithZephyr();
    const plugin = plugins[plugins.length - 1];

    bench('configResolved hook', () => {
      const config = {
        root: '/project/root',
        build: { outDir: 'dist' },
        publicDir: 'public',
      };

      // Just benchmark the hook call itself, not waiting for promises
      plugin.configResolved(config);
    });

    bench('transform hook', () => {
      // Just benchmark the hook call itself, not waiting for promises
      plugin.transform('const foo = "bar"', 'index.js');
    });
  });
});
