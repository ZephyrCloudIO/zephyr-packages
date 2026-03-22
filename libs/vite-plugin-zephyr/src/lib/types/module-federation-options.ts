export interface ModuleFederationRemoteConfig {
  name: string;
  entry: string;
  type?: string;
  [key: string]: unknown;
}

export interface ModuleFederationOptions {
  name?: string;
  filename?: string;
  remotes?: Record<string, string | ModuleFederationRemoteConfig>;
  exposes?: Record<string, string>;
  runtimePlugins?: string[];
  shared?: Record<string, unknown>;
  dts?: boolean | Record<string, unknown>;
  [key: string]: unknown;
}
