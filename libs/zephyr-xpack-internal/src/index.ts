export { onDeploymentDone, emitDeploymentDone } from './lifecycle-events';

export { isModuleFederationPlugin } from './xpack-extract/is-module-federation-plugin';
export {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
  xpack_delegate_module_template,
} from './xpack-extract';
export { buildWebpackAssetMap } from './xpack-extract/build-webpack-assets-map';

// Base plugin and common types
export * from './base-plugin';
export type {
  // Original exports
  XPackConfiguration,
  ModuleFederationPlugin,
  XStats,
  XStatsCompilation,

  // New common type exports
  ZePluginOptions,
  ZeInternalPluginOptions,
  ZeBundlerType,
  ZeBuildAsset,
  ZeBuildAssetsMap,
  ZeDependency,
} from './xpack.types';

export { getBuildStats } from './federation-dashboard-legacy/get-build-stats';

export { setupZeDeploy } from './hooks/ze-setup-ze-deploy';
export { logBuildSteps } from './hooks/ze-setup-build-steps-logging';

export { xpack_zephyr_agent } from './xpack-extract/ze-xpack-upload-agent';

// Testing utilities (only imported in test environment)
// These will be tree-shaken in production builds
export * from './testing';
