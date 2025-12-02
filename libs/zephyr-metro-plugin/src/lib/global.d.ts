/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-var */
declare global {
  // Global variables used for Zephyr runtime
  var __ZEPHYR_RUNTIME_PLUGIN__: any;
  var __ZEPHYR_RUNTIME_PLUGIN_INSTANCE__: any;
  var __ZEPHYR_MANIFEST_CHANGED__:
    | ((newManifest: any, oldManifest: any) => void)
    | undefined;
  var __ZEPHYR_OTA_WORKER_CLASS__: any;
  var __ZEPHYR_OTA_UPDATE_AVAILABLE__: ((update: any) => void) | undefined;
  var __ZEPHYR_OTA_RESTART_REQUIRED__: ((info: any) => void) | undefined;
  var __ZEPHYR_OTA_WORKER__: any;
  var __ZEPHYR_BUNDLE_MANAGER__: any;

  // Browser environment
  interface Window {
    __ZEPHYR_RUNTIME_PLUGIN__?: any;
    __ZEPHYR_RUNTIME_PLUGIN_INSTANCE__?: any;
  }
}

export {};
