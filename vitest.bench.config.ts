import codspeedPlugin from '@codspeed/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [codspeedPlugin()],
  test: {
    // Use the same environment as your tests
    environment: 'node',
    // Include ONLY our benchmarks folder, not the ones in the libs directory
    include: ['benchmarks/**/*.bench.js'],
    // Explicitly exclude all bench files in libs directory
    exclude: ['**/node_modules/**', 'libs/**', 'dist/**'],
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
