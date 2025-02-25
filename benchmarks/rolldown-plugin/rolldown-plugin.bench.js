import { bench, describe } from 'vitest';
import { withZephyr } from '../../libs/zephyr-rolldown-plugin/src/lib/zephyr-rolldown-plugin';

describe('rolldown-plugin-zephyr Performance', () => {
  bench('Plugin creation', () => {
    withZephyr();
  });

  describe('Plugin Hooks', () => {
    // Initialize plugin once for all benchmarks
    const plugin = withZephyr();

    bench('buildStart with string input', () => {
      // Just test the synchronous part
      const input = { input: '/path/to/input.js' };
      plugin.buildStart?.(input);
    });

    bench('buildStart with array input', () => {
      const input = { input: ['/path/one.js', '/path/two.js'] };
      plugin.buildStart?.(input);
    });

    bench('buildStart with object input', () => {
      const input = { input: { main: '/path/main.js', secondary: '/path/secondary.js' } };
      plugin.buildStart?.(input);
    });

    bench('buildStart with no input', () => {
      const input = {};
      plugin.buildStart?.(input);
    });
  });
});
