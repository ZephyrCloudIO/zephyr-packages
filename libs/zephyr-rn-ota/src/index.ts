/* istanbul ignore file */

// Core OTA Worker
export {
  ZephyrOTAWorker,
  type ZephyrOTAConfig,
  type ZephyrOTAUpdate,
  type ZephyrOTACallbacks,
} from './lib/zephyr-ota-worker';

// React Hooks
export {
  useZephyrOTA,
  useZephyrUpdateCheck,
  type UseZephyrOTAOptions,
  type ZephyrOTAState,
  type ZephyrOTAActions,
} from './lib/use-zephyr-ota';

// React Native Components
export {
  ZephyrOTAModal,
  ZephyrOTABanner,
  ZephyrOTAProvider,
  type ZephyrOTAModalProps,
  type ZephyrOTABannerProps,
  type ZephyrOTAProviderProps,
} from './lib/zephyr-ota-components';

// React Native Bundle Management
export { ReactNativeBundleManager, RNUpdateStrategies } from './lib/rn-bundle-manager';

// React Native Storage Abstraction
export { ZephyrRNStorage, rnStorage, type StorageInterface } from './lib/rn-storage';
