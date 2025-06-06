export { emitDeploymentDone, onDeploymentDone } from './lifecycle-events';

export {
  createMfRuntimeCode,
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
  xpack_delegate_module_template,
} from './xpack-extract';
export { buildWebpackAssetMap } from './xpack-extract/build-webpack-assets-map';
export { isModuleFederationPlugin } from './xpack-extract/is-module-federation-plugin';

export type {
  ModuleFederationPlugin,
  XPackConfiguration,
  XStats,
  XStatsCompilation,
} from './xpack.types';

export { getBuildStats } from './federation-dashboard-legacy/get-build-stats';

export { logBuildSteps } from './hooks/ze-setup-build-steps-logging';
export { setupZeDeploy } from './hooks/ze-setup-ze-deploy';

export { xpack_zephyr_agent } from './xpack-extract/ze-xpack-upload-agent';
