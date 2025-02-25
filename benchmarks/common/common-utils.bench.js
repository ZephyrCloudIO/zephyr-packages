import { bench, describe } from 'vitest';
import { ZephyrEngine } from '../../libs/zephyr-agent/src';

describe('Common Utilities Performance', () => {
  // Test ZephyrEngine creation performance
  bench('ZephyrEngine initialization (synchronous part)', () => {
    // Just test the synchronous part, not the async initialization
    ZephyrEngine.defer_create();
  });

  // Test deferred promise handling
  bench('ZephyrEngine deferred promise creation', () => {
    const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
    // Access the deferred promise to ensure it's initialized
    zephyr_defer_create({
      builder: 'test',
      context: '/sample/context',
    });
  });
});
