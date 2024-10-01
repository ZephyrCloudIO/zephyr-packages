export interface ZephyrInternalOptions {
  root: string;
  outDir: string;
  publicDir?: string;
  dir?: string;
}

export interface RemoteObjectConfig {
  type?: string;
  name?: string;
  entry: string;
  entryGlobalName?: string;
  shareScope?: string;
}

export interface ManifestOptions {
  filePath?: string;
  disableAssetsAnalyze?: boolean;
  fileName?: string;
}

export interface ModuleFederationOptions {
  exposes?:
    | Record<
        string,
        | string
        | {
            import: string;
          }
      >
    | undefined;
  filename?: string;
  library?: any;
  name: string;
  remotes?: Record<string, string | Partial<RemoteObjectConfig>> | undefined;
  runtime?: any;
  shareScope?: string;
  shared?:
    | string[]
    | Record<
        string,
        | string
        | {
            name?: string;
            version?: string;
            shareScope?: string;
            singleton?: boolean;
            requiredVersion?: string;
            strictVersion?: boolean;
          }
      >
    | undefined;
  runtimePlugins?: string[];
  getPublicPath?: any;
  implementation?: any;
  manifest?: ManifestOptions | boolean;
  dev?: any;
  dts?: any;
}

export interface ZephyrPartialInternalOptions {
  root: string;
  outDir: string;
  publicDir?: string;
}
