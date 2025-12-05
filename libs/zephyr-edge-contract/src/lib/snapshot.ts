/* istanbul ignore file */

export interface Snapshot {
  // app.repo.org
  application_uid: string;
  // package.json version + descriptor `.(user-(ci|ui?)-user_build_counter)`
  version: string;
  // original and immutable version url
  version_url?: string;
  // publishment timestamp (for tags and envs)
  published_at?: number;
  // version.app.repo.org
  snapshot_id: string;
  // default domain url
  domain: string;
  // snapshot type (e.g., 'ssr' for server-side rendering, 'csr' for client-side rendering)
  type?: 'ssr' | 'csr';
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
  // Public environment variables captured at build time (ZE_PUBLIC_* only)
  ze_envs?: Record<string, string>;
  // Content-addressable hash of ze_envs for deduplication
  ze_envs_hash?: string;
}

export interface SnapshotAsset {
  path: string;
  extname: string;
  hash: string;
  size: number;
}

export interface SnapshotMetadata {
  pages_url?: string;
  // Optional environment-level overrides for ZE_PUBLIC_* vars
  public_envs?: Record<string, string>;
  // Diagnostics / cache-key helpers
  version?: string;
  build_id?: string;
  etag?: string;
  // Optional nested env shape used by some adapters
  env?: { public?: Record<string, string> };
}
