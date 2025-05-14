/* istanbul ignore file */

export interface Snapshot {
  /** App.repo.org */
  application_uid: string;
  /** Package.json version + descriptor `.(user-(ci|ui?)-user_build_counter)` */
  version: string;
  /** Version.app.repo.org */
  snapshot_id: string;
  /** Default domain url */
  domain: string;
  uid: {
    build: string;
    app_name: string;
    repo: string;
    org: string;
  };
  variables?: SnapshotVariables;
  git: {
    name?: string;
    email?: string;
    branch: string;
    commit: string;
    tags?: string[];
  };
  /** Zephyr user */
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
  /** List of files, where key is file path */
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

export interface SnapshotVariables {
  /** The `assets/ze-envs-<hash>.js` generated full path with extension */
  filename: string;

  /** A unique list of environment variables used in the code */
  uses: string[];
}
