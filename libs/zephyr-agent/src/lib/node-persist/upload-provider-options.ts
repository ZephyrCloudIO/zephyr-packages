// libs/api/builder-packages-api/src/lib/builder-packages-api.service.ts
export interface ZeApplicationConfig {
  application_uid: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_DOMAIN: string;
  BUILD_ID_ENDPOINT: string;
  EDGE_URL: string;
  DELIMITER: string;
  fetched_at?: number;
  PLATFORM: UploadProviderType;
  // @deprecated
  email: string;
  // @deprecated
  jwt: string;
  // @deprecated
  user_uuid: string;
  // @deprecated
  username: string;
  build_target?: string;
  native_config_file_hash?: string;
}

export enum UploadProviderType {
  CLOUDFLARE = 'cloudflare',
  AWS = 'aws',
  NETLIFY = 'netlify',
  AZURE = 'azure',
  GCP = 'gcp',
  FASTLY = 'fastly',
  AKAMAI = 'akamai',
}
