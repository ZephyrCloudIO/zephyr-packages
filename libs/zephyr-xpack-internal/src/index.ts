export { emitDeploymentDone, onDeploymentDone } from './lifecycle-events';

export {
  createMfRuntimeCode,
  extractFederatedDependencyPairs,
  extractLibraryType,
  makeCopyOfModuleFederationOptions,
  mutPathModePublicPath,
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

export {
  getBuildStats,
  getModuleFederationBuildMetadata,
  type ModuleFederationBuildMetadata,
} from './federation-dashboard-legacy/get-build-stats';

export { setupManifestEmission } from './hooks/ze-emit-manifest';
export { logBuildSteps } from './hooks/ze-setup-build-steps-logging';
export { setupZeDeploy } from './hooks/ze-setup-ze-deploy';
export {
  XPackBuildCoordinator,
  type XPackBuildContribution,
  type XPackBuildCoordinatorOptions,
} from './xpack-extract/xpack-build-coordinator';
export {
  coordinateXPackCompilers,
  type CoordinatedCompiler,
  type XPackCompilerConfigLike,
} from './xpack-extract/multi-compiler-coordinator';

export { xpack_zephyr_agent } from './xpack-extract/ze-xpack-upload-agent';

export { detectAndStoreBaseHref, detectBaseHref } from './basehref/basehref-integration';

export {
  createZephyrRuntimePlugin,
  type ZephyrRuntimePluginOptions,
} from './xpack-extract/runtime-plugin';
