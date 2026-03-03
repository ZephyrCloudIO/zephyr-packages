// libs/api/builder-packages-api/src/lib/builder-packages-api.service.ts
export interface ZeApplicationConfig {
  application_uid: string;
  BUILD_ID_ENDPOINT: string;
  EDGE_URL: string;
  DELIMITER: string;
  PLATFORM: UploadProviderType;
  ENVIRONMENTS?: Record<string, EnvironmentConfig>;
  _metadata?: {
    isPrimary: boolean;
    integrationName: string;
    integrationId: string;
  };
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

  replicationTarget?: ReplicationTarget;
}

export interface ReplicationTarget {
  name: string;
  platform: string;
  edgeUrl: string;
  auth: {
    type: 'jwt' | 'api_key';
    token: string;
  };
  enabled: boolean;
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
