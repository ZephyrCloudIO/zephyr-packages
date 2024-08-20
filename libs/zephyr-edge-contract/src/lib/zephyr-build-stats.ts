export interface ZephyrBuildStats {
  /** */
  project: string;
  /** @description application_uid */
  id: string;
  /** */
  name: string;
  /**  */
  version: string;
  /**  */
  environment: string;
  /** */
  posted?: Date;
  /** @description default to `remoteEntry.js` unless user defines it
   */
  remote: string | undefined;
  /**  */
  metadata: unknown;
  /** @description this is for understanding what dependencies are being shared and created by the remote
   * @question how are we going to use it in the future  ?
   */
  overrides: ApplicationOverride[];
  /** @description the remotes this app is consuming */
  consumes: ApplicationConsumes[];
  /**
   * @description this is the component this app is exposing, includes the component name and file name
   */
  modules: ApplicationModule[];
  /** */
  tags: string[];
  /** @description dependencies in package.json */
  dependencies?: RawDependency[];
  /** @description optionalDependencies in package.json */
  optionalDependencies?: RawDependency[];
  /** @description peerDependencies in package.json */
  peerDependencies?: RawDependency[];
  /** @description  devDependencies in package.json */
  devDependencies?: RawDependency[];
  /** What does this default means and what it indicates? */
  default?: boolean;
  /** @description if this is a host app all the remotes goes into here from the mFConfig*/
  remotes?: string[];
  app: {
    /** @description name field from package.json */
    name: string;
    // npm version
    /** @description version field form package.json */
    version: string;
    /** @description if the repository's git remote url is https://github.com/ZephyrCloudIO/zephyr-mono, ZephyrCloudIO would be the org field here */
    org: string;
    /** @description if the repository's git remote url is https://github.com/ZephyrCloudIO/zephyr-mono, zephyr-mono would be the project field here */
    project: string;

    /** @description this is the user's uuid */
    buildId: string;
  };
  git: {
    /** @required To build a successfully through Zephyr user must have this field
  @description if the local git configuration sets a username this `git.name` would be the `git user.name`, see [ze-util-get-git-info] in zephyr-agent */
    name: string;

    /** @required To build a successfully through Zephyr user must have this field
 @description if the email of local git config is set this email is the `git user.email` */
    email: string;

    /** @required To build a successfully through Zephyr user must have this field
    @description if the branch of this repository is set this would be the result after running `git rev-parse --abbrev-ref HEAD` */
    branch: string;

    /** @requires To build a successfully through Zephyr user must have this field
  @description if there has been commit of this repo, this would be the result of `git rev-parse HEAD` */
    commit: string;
  };
  context: {
    /**  */
    /** */
    username?: string;
    isCI: boolean;
  };
  /** @description  become the first part of `remote_host` and `remote_entry_url` in database in `ApplicationTag` table
   */
  edge: {
    url: string;
    versionUrl?: string;
  };
  /** */
  domain?: string | undefined;
  platform?: DeploymentIntegrationPlatform | undefined;
  /**   */
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
