// Local type definitions to avoid external library dependencies
// Based on @module-federation/runtime-core@0.16.0

export interface Remote {
  name: string;
  alias?: string;
  entry?: string;
  type?: string;
  shareScope?: string;
  entryGlobalName?: string;
}

export interface Options {
  name: string;
  version?: string;
  remotes: Remote[];
  shared: { [pkgName: string]: any };
  plugins?: FederationRuntimePlugin[];
  shareStrategy?: 'version-first' | 'loaded-first';
}

export interface BeforeRequestHookArgs {
  id: string;
  options: Options;
  origin: any; // FederationHost
}

export interface FederationRuntimePlugin {
  name: string;
  version?: string;
  beforeRequest?: (
    args: BeforeRequestHookArgs
  ) => BeforeRequestHookArgs | Promise<BeforeRequestHookArgs>;
}

export interface RemoteWithEntry {
  name: string;
  alias?: string;
  entry: string;
}
