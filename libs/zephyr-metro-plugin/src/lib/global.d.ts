/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-var */
declare global {
  // Global variables used for Zephyr runtime
  var __ZEPHYR_RUNTIME_PLUGIN__: any;
  var __ZEPHYR_RUNTIME_PLUGIN_INSTANCE__: any;
  var __ZEPHYR_MANIFEST_CHANGED__:
    | ((newManifest: any, oldManifest: any) => void)
    | undefined;

  // Browser environment
  interface Window {
    __ZEPHYR_RUNTIME_PLUGIN__?: any;
    __ZEPHYR_RUNTIME_PLUGIN_INSTANCE__?: any;
  }
}

export {};
