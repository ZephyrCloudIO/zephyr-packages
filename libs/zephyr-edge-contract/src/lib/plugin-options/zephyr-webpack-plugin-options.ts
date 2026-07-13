import type { ZephyrBuildTarget } from '../build-target';
import type {
  ZephyrLegacyModuleFederationConfig,
  ZephyrModuleFederationConfig,
} from '../module-federation';

export interface ZephyrPluginOptions {
  pluginName: string;
  isCI: boolean;
  buildEnv: string;
  username: string;
  zeConfig: {
    edge_url: string;
    user: string;
    buildId: string;
  };
  application_uid: string;
  // ZeApplicationProperties
  app: {
    org: string;
    project: string;
    name: string;
    version: string;
  };
  git: {
    name: string;
    email: string;
    branch: string;
    commit: string;
    tags?: string[];
  };
  /** Legacy single-container federation config. */
  mfConfig?: ZephyrLegacyModuleFederationConfig;
  /** Every independently published config in a multi-container build. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  // for react native and dynamic platforms
  target?: ZephyrBuildTarget | undefined;
  // For react native host app which doesn't want to be "always uploaded and deployed"
  // hacks
  wait_for_index_html?: boolean;
  outputPath?: string;
}
