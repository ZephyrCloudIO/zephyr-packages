export { onDeploymentDone, emitDeploymentDone } from './lifecycle-events';

export { isModuleFederationPlugin } from './xpack-extract/is-module-federation-plugin';
export {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
  xpack_delegate_module_template,
} from './xpack-extract';
export { buildWebpackAssetMap } from './xpack-extract/build-webpack-assets-map';

export type {
  XPackConfiguration,
  ModuleFederationPlugin,
  XStats,
  XStatsCompilation,
} from './xpack.types';

export { getBuildStats } from './federation-dashboard-legacy/get-build-stats';

export { logBuildSteps } from './hooks/ze-setup-build-steps-logging';
