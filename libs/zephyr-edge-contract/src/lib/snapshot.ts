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
  git: {
    name?: string;
    email?: string;
    branch: string;
    commit: string;
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
