import type { AttributionRepositoryPolicy } from 'zephyr-edge-contract';

export interface ZeApplicationConfig {
  application_uid: string;
  BUILD_ID_ENDPOINT: string;
  EDGE_URL: string;
  DELIMITER: string;
  PLATFORM: UploadProviderType;
  ENVIRONMENTS?: Record<string, EnvironmentConfig>;
  fetched_at?: number;
  /**
   * Set by the API only when the application deploys to the default Zephyr Cloudflare
   * edge without additional environment edges. Missing means not eligible for private MCP
   * provider snapshots.
   */
  MCP_PRIVATE_SNAPSHOTS?: boolean;
  /** Server-owned, repository-scoped policy. Never trust a tier from repo JSON. */
  ATTRIBUTION_POLICY?: AttributionRepositoryPolicy;

  // todo: remove this after moving to a new auth flow which will provide user jwt separately from the application configuration
  // @deprecated
  email: string;
  // @deprecated
  jwt: string;
  // @deprecated
  user_uuid: string;
  // @deprecated
  username: string;
}

export enum UploadProviderType {
  CLOUDFLARE = 'cloudflare',
  AWS = 'aws',
  NETLIFY = 'netlify',
  AZURE = 'azure',
  GCP = 'gcp',
  FASTLY = 'fastly',
  AKAMAI = 'akamai',
  CUSTOM = 'custom',
}

export interface EnvironmentConfig {
  type: UploadProviderType;
  edgeUrl: string;
  delimiter: string;
  remote_host: string;
}
