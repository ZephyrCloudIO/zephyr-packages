/* istanbul ignore file */

import type {
  ZephyrLegacyModuleFederationConfig,
  ZephyrModuleFederationConfig,
} from './module-federation';
import type { ZephyrBuildTarget } from './build-target';

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
  // how the edge worker should address this deployment; worker defaults to 'hostname'
  addressMode?: 'hostname' | 'path';
  // snapshot type (e.g., 'ssr' for server-side rendering, 'csr' for client-side rendering)
  type?: 'ssr' | 'csr';
  /** Typed artifact family carried with the immutable snapshot upload. */
  target: ZephyrBuildTarget;
  // server entry file path for SSR applications (relative path)
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
  // zephyr user
  creator: {
    name: string;
    email: string;
  };
  createdAt: number;
  /** Legacy single-container federation config. */
  mfConfig?: ZephyrLegacyModuleFederationConfig;
  /** Every independently published config in a multi-container build. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  // list of files, where key is file path
  assets: Record<string, SnapshotAsset>;
  // Public environment variables captured at build time (ZE_PUBLIC_* only)
  ze_envs?: Record<string, string>;
  // Content-addressable hash of ze_envs for deduplication
  ze_envs_hash?: string;
  // bundler plugin type (e.g. 'webpack', 'vite', 'rspack')
  builder?: string;
  // version of the zephyr plugin (zephyr-edge-contract/zephyr-agent)
  plugin_version?: string;
  // version of the edge worker that processed the snapshot
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
  // Optional environment-level overrides for ZE_PUBLIC_* vars
  public_envs?: Record<string, string>;
  // Diagnostics / cache-key helpers
  version?: string;
  build_id?: string;
  etag?: string;
  // Optional nested env shape used by some adapters
  env?: { public?: Record<string, string> };
}
