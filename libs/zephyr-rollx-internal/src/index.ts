// Module Federation
export {
  extract_mf_plugin,
  extractMFConfig,
} from './lib/module-federation/extract-mf-plugin';
export { extract_remotes_dependencies } from './lib/module-federation/extract-remotes';
export { load_resolved_remotes } from './lib/module-federation/load-resolved-remotes';

// build stats
export {
  extractRollxBuffer,
  getRollxAssetsMap,
  getRollxAssetType,
} from './lib/assets-map';
export { extractRollxBuildStats } from './lib/extract-build-stats';

// remote regex
export { viteLikeRemoteRegex } from './lib/remote-regex';

// types
export {
  type XFederatedConfig,
  type XOutputAsset,
  type XOutputBundle,
  type XOutputChunk,
} from './types/index';
