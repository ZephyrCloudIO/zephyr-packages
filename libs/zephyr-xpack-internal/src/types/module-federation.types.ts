// Local type definitions to avoid external library dependencies
// Based on @module-federation/runtime-core@0.16.0

export interface ShareScopeMap {
  [scopeName: string]: {
    [pkgName: string]: {
      [version: string]: {
        get: () => any;
        loaded?: boolean;
        from?: string;
        eager?: boolean;
      };
    };
  };
}

export interface ShareInfos {
  [pkgName: string]: {
    version: string;
    scope: string[];
    useIn: string[];
    from: string;
    lib: () => any;
    deps: string[];
    strategy?: 'version-first' | 'loaded-first';
    shareConfig?: any;
  };
}

export interface Remote {
  name: string;
  alias?: string;
  entry?: string;
  type?: string;
  shareScope?: string;
  entryGlobalName?: string;
}

export interface Shared {
  version: string;
  scope: string[];
  useIn: string[];
  from: string;
  lib: () => any;
  deps: string[];
  strategy?: 'version-first' | 'loaded-first';
  shareConfig?: any;
}

export interface Options {
  name: string;
  version?: string;
  remotes: Remote[];
  shared: { [pkgName: string]: Shared[] };
  plugins?: FederationRuntimePlugin[];
  shareStrategy?: 'version-first' | 'loaded-first';
}

export interface UserOptions {
  name: string;
  version?: string;
  remotes?: Remote[];
  shared?: Record<string, any>;
  plugins?: FederationRuntimePlugin[];
  shareStrategy?: 'version-first' | 'loaded-first';
}

export interface RemoteInfo {
  name: string;
  alias?: string;
  entry: string;
  type?: string;
  shareScope?: string;
  entryGlobalName?: string;
}

export interface ModuleInfo {
  name: string;
  buildVersion: string;
  publicPath: string;
  types: {
    path: string;
    name: string;
    zip?: string;
    api?: string;
  };
  remotes: Array<{
    federationContainerName: string;
    moduleName: string;
    alias: string;
    entry: string;
  }>;
  shared: Array<{
    id: string;
    name: string;
    version: string;
    requiredVersion: string;
    assets: {
      js: {
        sync: string[];
        async: string[];
      };
      css: {
        sync: string[];
        async: string[];
      };
    };
  }>;
  exposes: Record<
    string,
    {
      id: string;
      name: string;
      assets: {
        js: {
          sync: string[];
          async: string[];
        };
        css: {
          sync: string[];
          async: string[];
        };
      };
    }
  >;
}

// Core lifecycle hooks
export interface BeforeInitHookArgs {
  userOptions: UserOptions;
  options: Options;
  origin: any; // FederationHost
  shareInfo: ShareInfos;
}

export interface InitHookArgs {
  options: Options;
  origin: any; // FederationHost
}

export interface BeforeInitContainerHookArgs {
  shareScope: ShareScopeMap[string];
  initScope: Record<string, any>;
  remoteEntryInitOptions: any;
  remoteInfo: RemoteInfo;
  origin: any; // FederationHost
}

export interface InitContainerHookArgs {
  shareScope: ShareScopeMap[string];
  initScope: Record<string, any>;
  remoteEntryInitOptions: any;
  remoteInfo: RemoteInfo;
  remoteEntryExports: any;
  origin: any; // FederationHost
  id: string;
  remoteSnapshot?: ModuleInfo;
}

// Remote lifecycle hooks
export interface BeforeRegisterRemoteHookArgs {
  remote: Remote;
  origin: any; // FederationHost
}

export interface RegisterRemoteHookArgs {
  remote: Remote;
  origin: any; // FederationHost
}

export interface BeforeRequestHookArgs {
  id: string;
  options: Options;
  origin: any; // FederationHost
}

export interface OnLoadHookArgs {
  id: string;
  expose: string;
  pkgNameOrAlias: string;
  remote: Remote;
  options: any; // ModuleOptions
  origin: any; // FederationHost
  exposeModule: any;
  exposeModuleFactory: any;
  moduleInstance: any; // Module
}

// Shared lifecycle hooks
export interface AfterResolveHookArgs {
  id: string;
  pkgNameOrAlias: string;
  expose: string;
  remote: Remote;
  options: Options;
  origin: any; // FederationHost
  remoteInfo: RemoteInfo;
  remoteSnapshot?: ModuleInfo;
}

export interface BeforeLoadShareHookArgs {
  pkgName: string;
  shareInfo?: Shared;
  shared: Options['shared'];
  origin: any; // FederationHost
}

export interface LoadShareHookArgs {
  origin: any; // FederationHost
  pkgName: string;
  shareInfos: ShareInfos;
}

export interface ResolveShareHookArgs {
  shareScopeMap: ShareScopeMap;
  scope: string;
  pkgName: string;
  version: string;
  GlobalFederation: any;
  resolver: () => Shared | undefined;
}

export interface InitContainerShareScopeMapHookArgs {
  shareScope: ShareScopeMap[string];
  options: Options;
  origin: any; // FederationHost
  scopeName: string;
  hostShareScopeMap?: ShareScopeMap;
}

// Snapshot lifecycle hooks
export interface BeforeLoadRemoteSnapshotHookArgs {
  options: Options;
  moduleInfo: Remote;
}

export interface LoadSnapshotHookArgs {
  options: Options;
  moduleInfo: Remote;
  hostGlobalSnapshot: any;
  globalSnapshot: any;
  remoteSnapshot?: any;
}

export interface LoadRemoteSnapshotHookArgs {
  options: Options;
  moduleInfo: Remote;
  manifestJson?: any;
  manifestUrl?: string;
  remoteSnapshot: ModuleInfo;
  from: 'global' | 'manifest';
}

export interface AfterLoadSnapshotHookArgs {
  id?: string;
  host: any; // FederationHost
  options: Options;
  moduleInfo: Remote;
  remoteSnapshot: ModuleInfo;
}

// Loader hooks
export interface GetModuleInfoHookArgs {
  target: Record<string, any>;
  key: any;
}

export interface CreateScriptHookArgs {
  url: string;
  attrs?: Record<string, any>;
}

export interface CreateLinkHookArgs {
  url: string;
  attrs?: Record<string, any>;
}

export interface FetchHookArgs {
  url: string;
  init: RequestInit;
}

export interface LoadEntryErrorHookArgs {
  getRemoteEntry: any;
  origin: any; // FederationHost
  remoteInfo: RemoteInfo;
  remoteEntryExports?: any;
  globalLoading: Record<string, Promise<void | any> | undefined>;
  uniqueKey: string;
}

export interface GetModuleFactoryHookArgs {
  remoteEntryExports: any;
  expose: string;
  moduleInfo: RemoteInfo;
}

// Bridge hooks
export type BeforeBridgeRenderHookArgs = Record<string, any>;
export type AfterBridgeRenderHookArgs = Record<string, any>;
export type BeforeBridgeDestroyHookArgs = Record<string, any>;
export type AfterBridgeDestroyHookArgs = Record<string, any>;

// Complete FederationRuntimePlugin interface based on @module-federation/runtime-core
export interface FederationRuntimePlugin {
  name: string;
  version?: string;

  // Core lifecycle hooks
  beforeInit?: (
    args: BeforeInitHookArgs
  ) => BeforeInitHookArgs | Promise<BeforeInitHookArgs>;
  init?: (args: InitHookArgs) => void;
  beforeInitContainer?: (
    args: BeforeInitContainerHookArgs
  ) => BeforeInitContainerHookArgs | Promise<BeforeInitContainerHookArgs>;
  initContainer?: (
    args: InitContainerHookArgs
  ) => InitContainerHookArgs | Promise<InitContainerHookArgs>;

  // Remote lifecycle hooks
  beforeRegisterRemote?: (
    args: BeforeRegisterRemoteHookArgs
  ) => BeforeRegisterRemoteHookArgs | Promise<BeforeRegisterRemoteHookArgs>;
  registerRemote?: (
    args: RegisterRemoteHookArgs
  ) => RegisterRemoteHookArgs | Promise<RegisterRemoteHookArgs>;
  beforeRequest?: (
    args: BeforeRequestHookArgs
  ) => BeforeRequestHookArgs | Promise<BeforeRequestHookArgs>;
  onLoad?: (args: OnLoadHookArgs) => void | Promise<void>;

  // Shared lifecycle hooks
  afterResolve?: (
    args: AfterResolveHookArgs
  ) => AfterResolveHookArgs | Promise<AfterResolveHookArgs>;
  beforeLoadShare?: (
    args: BeforeLoadShareHookArgs
  ) => BeforeLoadShareHookArgs | Promise<BeforeLoadShareHookArgs>;
  loadShare?: (args: LoadShareHookArgs) => false | void | Promise<false | void>;
  resolveShare?: (
    args: ResolveShareHookArgs
  ) => ResolveShareHookArgs | Promise<ResolveShareHookArgs>;
  initContainerShareScopeMap?: (
    args: InitContainerShareScopeMapHookArgs
  ) => InitContainerShareScopeMapHookArgs | Promise<InitContainerShareScopeMapHookArgs>;

  // Snapshot lifecycle hooks
  beforeLoadRemoteSnapshot?: (
    args: BeforeLoadRemoteSnapshotHookArgs
  ) => void | Promise<void>;
  loadSnapshot?: (
    args: LoadSnapshotHookArgs
  ) => LoadSnapshotHookArgs | Promise<LoadSnapshotHookArgs>;
  loadRemoteSnapshot?: (
    args: LoadRemoteSnapshotHookArgs
  ) => LoadRemoteSnapshotHookArgs | Promise<LoadRemoteSnapshotHookArgs>;
  afterLoadSnapshot?: (
    args: AfterLoadSnapshotHookArgs
  ) => AfterLoadSnapshotHookArgs | Promise<AfterLoadSnapshotHookArgs>;

  // Loader hooks
  getModuleInfo?: (args: GetModuleInfoHookArgs) => void | { value: any; key: string };
  createScript?: (args: CreateScriptHookArgs) => any; // CreateScriptHookReturn
  createLink?: (args: CreateLinkHookArgs) => void | HTMLLinkElement;
  fetch?: (args: FetchHookArgs) => false | void | Promise<Response>;
  loadEntryError?: (
    args: LoadEntryErrorHookArgs
  ) => Promise<(() => Promise<any>) | undefined>;
  getModuleFactory?: (
    args: GetModuleFactoryHookArgs
  ) => Promise<(() => Promise<any>) | undefined>;

  // Bridge hooks
  beforeBridgeRender?: (args: BeforeBridgeRenderHookArgs) => void | Record<string, any>;
  afterBridgeRender?: (args: AfterBridgeRenderHookArgs) => void | Record<string, any>;
  beforeBridgeDestroy?: (args: BeforeBridgeDestroyHookArgs) => void | Record<string, any>;
  afterBridgeDestroy?: (args: AfterBridgeDestroyHookArgs) => void | Record<string, any>;
}

export interface RemoteWithEntry {
  name: string;
  alias?: string;
  entry: string;
}
