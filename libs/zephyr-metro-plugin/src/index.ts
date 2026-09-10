/* istanbul ignore file */

// Metro plugin exports
export {
  withZephyr,
  withZephyrMetro,
  type ZephyrMetroOptions,
  type ZephyrModuleFederationConfig,
} from './lib/with-zephyr';

// CLI command wrapper export for bundle-mf-remote integrations
export {
  zephyrCommandWrapper,
  type MetroConfig,
  type MetroFederationConfig,
} from './lib/zephyr-metro-command-wrapper';

// React Native CLI adapter for Module Federation host/remote publication commands
export {
  zephyrMetroReactNativeCli,
  type ReactNativeCliCommand,
  type ZephyrMetroReactNativeCliAdapter,
  type ZephyrMetroReactNativeCliConfig,
} from './lib/zephyr-metro-react-native-cli';

// RNEF plugin export for Module Federation host/remote bundling commands
export {
  zephyrMetroRNEFPlugin,
  type ZephyrMetroRNEFPluginConfig,
  type RNEFPluginApi,
} from './lib/zephyr-metro-rnef-plugin';
