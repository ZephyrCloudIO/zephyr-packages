import { defineConfig } from 'vitest/config';

// Since we don't have access to @codspeed/vitest-plugin (it's not compatible with our setup),
// we'll use Vitest's built-in benchmark support
export default defineConfig({
  test: {
    // Use the same environment as your tests
    environment: 'node',
    // Include benchmarks only
    include: ['benchmarks/**/*.bench.js'],
    // Exclude the old bench files in libs directory
    exclude: ['libs/**/*.bench.ts'],
    // Never timeout in benchmark mode
    testTimeout: 0,
    // Benchmark-specific configuration
    benchmark: {
      // Allow collecting many samples
      iterations: 10,
      warmupIterations: 5,
    },
  },
});
