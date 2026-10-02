import type { Federation } from '@module-federation/runtime';

// `__ZEPHYR__` is declared by zephyr-edge-contract (pulled in by its type imports).

declare global {
  /**
   * Module Federation runtime global, set before any `beforeInit` hook runs. Declared
   * exactly as zephyr-native-cache does so both can share a program.
   */
  var __FEDERATION__: Federation;
}

export {};
