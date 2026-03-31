/* istanbul ignore file */

// Metro plugin exports
export {
  withZephyr,
  withZephyrMetro,
  type ZephyrMetroOptions,
  type ZephyrModuleFederationConfig
} from './lib/with-zephyr';

// CLI command wrapper export for bundle-mf-remote integrations
export {
  zephyrCommandWrapper,
  type MetroConfig,
  type MetroFederationConfig,
} from './lib/zephyr-metro-command-wrapper';

// Transformer (usually not imported directly but referenced by path)
export { transform as zephyrTransformer } from './lib/zephyr-transformer';
