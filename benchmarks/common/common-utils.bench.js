import { bench, describe } from 'vitest';

// Mock the ZephyrEngine
const mockZephyrEngine = {
  defer_create: () => {
    const mockEngine = {
      buildProperties: {},
      start_new_build: () => Promise.resolve(),
      upload_assets: () => Promise.resolve(),
      build_finished: () => Promise.resolve(),
    };

    return {
      zephyr_engine_defer: Promise.resolve(mockEngine),
      zephyr_defer_create: () => {},
    };
  },
};

describe('Common Utilities Performance', () => {
  // Test ZephyrEngine creation performance
  bench('ZephyrEngine initialization (synchronous part)', () => {
    // Just test the synchronous part, not the async initialization
    mockZephyrEngine.defer_create();
  });

  // Test deferred promise handling
  bench('ZephyrEngine deferred promise creation', () => {
    const { zephyr_engine_defer, zephyr_defer_create } = mockZephyrEngine.defer_create();
    // Access the deferred promise to ensure it's initialized
    zephyr_defer_create({
      builder: 'test',
      context: '/sample/context',
    });
  });
});
