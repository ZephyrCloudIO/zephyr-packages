import type { OutputAsset as RollupOutputAsset } from 'rollup';

export type OutputAsset = RollupOutputAsset;

export interface XFederatedSharedConfig {
  singleton?: boolean;
  requiredVersion?: string;
  version?: string;
  eager?: boolean;
  libraryName?: string;
}

export interface XAdditionalSharedConfig {
  libraryName: string;
  sharedConfig?: {
    singleton?: boolean;
    requiredVersion?: string;
  };
}

export interface XFederatedConfig {
  name: string;
  library?:
    | {
        type?: string;
      }
    | any;
  shared?: Record<string, string | XFederatedSharedConfig> | string[] | any;
  remotes?: (string | RemotesObject)[] | RemotesObject | any;
  exposes?: Record<string, string | { import: string } | any> | any;
  filename?: string;
  bundle_name?: string;
  additionalShared?:
    | string[]
    | Record<string, string | XFederatedSharedConfig>
    | XAdditionalSharedConfig[]
    | any;
}

export interface ModuleFederationPlugin {
  apply: (compiler: unknown) => void;
  _options?: XFederatedConfig | { config: XFederatedConfig };
  config?: XFederatedConfig;
}

interface RemotesObject {
  [index: string]: string | RemotesConfig | string[];
}

interface RemotesConfig {
  external: string | string[];
  shareScope?: string;
}
