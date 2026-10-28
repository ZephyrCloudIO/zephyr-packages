export interface ZeApplicationConfig {
  application_uid: string;
  BUILD_ID_ENDPOINT: string;
  EDGE_URL: string;
  DELIMITER: string;
  PLATFORM: UploadProviderType;
  ENVIRONMENTS?: Record<string, EnvironmentConfig>;
  /** Advertised only by runtimes implementing the complete Cloudflare deployment contract. */
  capabilities?: { cloudflareDeployment?: 1 };
  fetched_at?: number;

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
