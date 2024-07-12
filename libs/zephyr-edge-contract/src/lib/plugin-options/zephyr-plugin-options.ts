export interface ZephyrPluginOptions {
  pluginName: string;
  isCI: boolean;
  buildEnv: string;
  username: string;
  zeConfig: {
    edge_url: string;
    user: string;
    buildId: string | undefined;
  };
  application_uid: string;
  app: {
    org: string;
    project: string;
    name: string;
    version: string;
  };
  git: {
    name?: string;
    email?: string;
    branch: string;
    commit: string;
  };
  mfConfig?: {
    name: string;
    filename: string;
    exposes?: Record<string, string>;
    remotes?: Record<string, string>;
    shared?: Record<string, unknown>;
  };
  // hacks
  wait_for_index_html?: boolean;
  outputPath?: string;
}
