/* istanbul ignore file */

export interface Snapshot {
  // app.repo.org
  application_uid: string;
  // package.json version + descriptor `.(user-(ci|ui?)-user_build_counter)`
  version: string;
  // version.app.repo.org
  snapshot_id: string;
  // default domain url
  domain: string;
  uid: {
    build: string;
    app_name: string;
    repo: string;
    org: string;
  };
  // globalThis[Symbol.for('zephyr:envs')]
  envs: {
    /**
     * SHould match a key on {@linkcode assets}, ideally random to not be easily
     * identifiable
     */
    filename: string;
    requirements: {
      /**
       * @example
       *   `ZE_BACKEND_URL`;
       */
      name: string;
    }[];
  };
  git: {
    name?: string;
    email?: string;
    branch: string;
    commit: string;
    tags?: string[];
  };
  // zephyr user
  creator: {
    name: string;
    email: string;
  };
  createdAt: number;
  mfConfig?: {
    name: string;
    filename: string;
    exposes?: Record<string, string>;
    remotes?: Record<string, string>;
    shared?: Record<string, unknown>;
  };
  // list of files, where key is file path
  assets: Record<string, SnapshotAsset>;
}

export interface SnapshotAsset {
  path: string;
  extname: string;
  hash: string;
  size: number;
}

export interface SnapshotMetadata {
  pages_url?: string;
}
