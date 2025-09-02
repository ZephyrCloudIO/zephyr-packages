/* istanbul ignore file */

/** Todo: this worst and most outdated model so far, had to be refactored */
export interface ZephyrBuildStats {
  /** @deprecated */
  project: string;
  /** Application_uid */
  id: string;
  name: string;
  version: string;
  /** @deprecated */
  environment: string;
  posted?: Date;
  /** Default to `remoteEntry.js` unless user defines it */
  remote: string | undefined;
  /** @deprecated - Never use meta, metadata and other senseless data aggregator names */
  metadata: unknown;
  /**
   * This is for understanding what dependencies are being shared and created by the
   * remote
   *
   * @question how are we going to use it in the future  ?
   */
  overrides: ApplicationOverride[];
  /** The remotes this app is consuming */
  consumes: ApplicationConsumes[];
  /** This is the component this app is exposing, includes the component name and file name */
  modules: ApplicationModule[];
  /** @deprecated */
  tags: string[];
  /** Dependencies in package.json */
  dependencies?: RawDependency[];
  /** OptionalDependencies in package.json */
  optionalDependencies?: RawDependency[];
  /** PeerDependencies in package.json */
  peerDependencies?: RawDependency[];
  /** DevDependencies in package.json */
  devDependencies?: RawDependency[];
  /** @deprecated - What does this default means and what it indicates? */
  default?: boolean;
  /** If this is a host app all the remotes goes into here from the mFConfig */
  remotes?: string[];
  app: {
    /** Name field from package.json */
    name: string;
    // npm version
    /** Version field form package.json */
    version: string;
    /**
     * If the repository's git remote url is
     * https://github.com/ZephyrCloudIO/zephyr-packages, ZephyrCloudIO would be the org
     * field here
     */
    org: string;
    /**
     * If the repository's git remote url is
     * https://github.com/ZephyrCloudIO/zephyr-packages, zephyr-packages would be the
     * project field here
     */
    project: string;

    /** This is the user's uuid */
    buildId: string;
  };
  git: {
    /**
     * If the local git configuration sets a username this `git.name` would be the `git
     * user.name`, see [ze-util-get-git-info] in zephyr-agent
     *
     * @required To build a successfully through Zephyr user must have this field
     */
    name: string;

    /**
     * If the email of local git config is set this email is the `git user.email`
     *
     * @required To build a successfully through Zephyr user must have this field
     */
    email: string;

    /**
     * If the branch of this repository is set this would be the result after running `git
     * rev-parse --abbrev-ref HEAD`
     *
     * @required To build a successfully through Zephyr user must have this field
     */
    branch: string;

    /**
     * If there has been commit of this repo, this would be the result of `git rev-parse
     * HEAD`
     *
     * @requires To build a successfully through Zephyr user must have this field
     */
    commit: string;

    /**
     * Git tags that point to the current commit, retrieved using `git tag --points-at
     * HEAD`
     *
     * @optional This field will be an empty array if no tags point to the current commit
     */
    tags?: string[];
  };
  context: {
    username?: string;
    isCI: boolean;
  };
  /**
   * Become the first part of `remote_host` and `remote_entry_url` in database in
   * `ApplicationTag` table
   */
  edge: {
    url: string;
    versionUrl?: string;
    delimiter: string;
  };
  domain?: string | undefined;
  /** @deprecated */
  platform?: DeploymentIntegrationPlatform | undefined;
  /**
   * The target platform of the build , should be `ios`, `android`, `web` or undefined at
   * the moment
   */
  build_target?: string;
  /** @deprecated */
  type: unknown;
  /** Public environment variables captured at build time (ZE_PUBLIC_* only) */
  ze_envs?: Record<string, string>;
  /** Content-addressable hash of ze_envs for deduplication */
  ze_envs_hash?: string;
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
