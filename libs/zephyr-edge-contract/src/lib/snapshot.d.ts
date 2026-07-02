export interface Snapshot {
  application_uid: string;
  version: string;
  version_url?: string;
  published_at?: number;
  snapshot_id: string;
  domain: string;
  type?: 'ssr' | 'csr';
  entrypoint?: string;
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
    tags?: string[];
  };
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
  assets: Record<string, SnapshotAsset>;
  ze_envs?: Record<string, string>;
  ze_envs_hash?: string;
  builder?: string;
  plugin_version?: string;
  worker_version?: string;
}
export interface SnapshotAsset {
  path: string;
  extname: string;
  hash: string;
  size: number;
}
export interface SnapshotMetadata {
  pages_url?: string;
  public_envs?: Record<string, string>;
  version?: string;
  build_id?: string;
  etag?: string;
  env?: {
    public?: Record<string, string>;
  };
}
