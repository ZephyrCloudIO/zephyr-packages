import type { BundleCacheLayer } from './BundleCacheLayer';

declare module '@module-federation/runtime' {
  interface Federation {
    __NATIVE__: {
      __CACHE_LAYER__?: BundleCacheLayer;
      __CACHE__?: (
        fallback: (bundlePath: string) => Promise<void>,
        bundlePath: string
      ) => Promise<void>;
      [key: string]: unknown;
    };
  }
}

declare global {
  // @ts-expect-error -- Intentional redeclaration for Metro/React Native runtime global.
  var __DEV__: boolean;
  var __FUSEBOX_HAS_FULL_CONSOLE_SUPPORT__: boolean;
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  var __FEDERATION__: import('@module-federation/runtime').Federation;
  var __MFE_CHECK_UPDATES__: () => Promise<{ updated: number; checked: number }>;
  var __MFE_START_UPDATE_POLLING__: (intervalMs?: number) => void;
  var __MFE_STOP_UPDATE_POLLING__: () => void;
}
