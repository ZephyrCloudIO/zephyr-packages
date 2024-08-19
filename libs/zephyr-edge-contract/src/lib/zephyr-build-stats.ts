export interface ZephyrBuildStats {
  project: string;

  id: string;
  name: string;
  version: string;
  environment: string;
  posted?: Date;
  remote: string | undefined;
  metadata: unknown;
  overrides: ApplicationOverride[];
  consumes: ApplicationConsumes[];
  modules: ApplicationModule[];
  tags: string[];
  dependencies?: RawDependency[];
  optionalDependencies?: RawDependency[];
  peerDependencies?: RawDependency[];
  devDependencies?: RawDependency[];
  default?: boolean;
  remotes?: string[];
  app: {
    name: string;
    // npm version
    version: string;
    org: string;
    project: string;
    buildId: number;
  };
  git: {
    // user name
    name: string;
    email: string;
    branch: string;
    commit: string;
  };
  context: {
    username: string;
    isCI: boolean;
  };
  edge: {
    url: string;
    versionUrl?: string;
  };
  domain?: string | undefined;
  platform?: DeploymentIntegrationPlatform | undefined;
  type: unknown;
}

enum DeploymentIntegrationPlatform {
  CLOUDFLARE = 'cloudflare',
  AWS = 'aws',
  NETLIFY = 'netlify',
  AZURE = 'azure',
  GCP = 'gcp',
}

export interface RawDependency {
  name: string;
  version: string;
}

export interface ApplicationModule {
  id: string;
  name: string;
  applicationID: string;
  requires: string[];
  file: string;
}

export interface ApplicationOverride {
  id: string;
  name: string;
  version: string;
  location: string;
  applicationID: string;
}

export interface ApplicationConsumes {
  consumingApplicationID: string;
  applicationID: string;
  name: string;
  usedIn: UsedIn[];
}

export interface UsedIn {
  file: string;
  url: string;
}
