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
  };
  mfConfig?: {
    name: string;
    filename: string;
    exposes?: Record<string, string>;
    remotes?: Record<string, string>;
    shared?: Record<string, unknown>;
    runtimePlugins?: string[] | undefined;
  };
  // for react native and dynamic platforms
  target?: 'ios' | 'android' | 'web' | undefined;
  // For react native host app which doesn't want to be "always uploaded and deployed"
  // hacks
  wait_for_index_html?: boolean;
  outputPath?: string;
}
