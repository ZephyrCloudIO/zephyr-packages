import { bench, describe } from 'vitest';

// Mock the withZephyr function to avoid authentication and network calls
function mockWithZephyr() {
  return {
    name: 'with-zephyr',
    buildStart: (options) => {
      // Just perform the synchronous part of getting input folder
      const input = options.input || {};
      return null;
    },
    writeBundle: () => {
      // Return a resolved promise to simulate the async operation
      return Promise.resolve();
    },
  };
}

describe('rolldown-plugin-zephyr Performance', () => {
  bench('Plugin creation', () => {
    mockWithZephyr();
  });

  describe('Plugin Hooks', () => {
    // Initialize plugin once for all benchmarks
    const plugin = mockWithZephyr();

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
