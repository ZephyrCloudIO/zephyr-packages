import { bench, describe } from 'vitest';
import { withZephyr } from '../../libs/vite-plugin-zephyr/src/lib/vite-plugin-zephyr';

describe('vite-plugin-zephyr Performance', () => {
  bench('Plugin creation', () => {
    withZephyr();
  });

  bench('Create with module federation config', () => {
    withZephyr({ mfConfig: { name: 'host', remotes: {} } });
  });

  describe('Plugin Hooks', () => {
    // Initialize plugin once for all benchmarks
    const plugins = withZephyr();
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
