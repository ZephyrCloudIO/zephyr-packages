export interface FederationDashboardPluginOptions {
  app?: {
    // git org
    org: string;
    // git repo
    project: string;
    // package.json name
    name: string;
    // package.json version
    version: string;
  };
  // todo: what if git not configured? - skip for now
  git?: {
    name?: string;
    email?: string;
    branch: string;
    commit: string;
  };

  context: {
    isCI: boolean;
  };

  debug: boolean;
  filename: string;
  useAST: boolean;
  standalone?: boolean;
  dashboardURL?: string;
  metadata?: Record<string, string | { url: string }>;
  environment?: string;
  versionStrategy?: string;
  posted?: Date;
  group?: string;
  nextjs?: string;
  packageJsonPath?: string;
}
