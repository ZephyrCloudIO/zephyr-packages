export { onDeploymentDone, emitDeploymentDone } from './lifecycle-events';

export { isModuleFederationPlugin } from './xpack-extract/is-module-federation-plugin';
export {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from './xpack-extract';
export { buildWebpackAssetMap } from './xpack-extract/build-webpack-assets-map';

export type { XPackConfiguration, ModuleFederationPlugin } from './xpack.types';

export { getBuildStats } from './federation-dashboard-legacy/get-build-stats';
