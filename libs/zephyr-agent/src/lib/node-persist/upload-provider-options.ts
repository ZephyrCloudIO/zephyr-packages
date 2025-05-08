// libs/api/builder-packages-api/src/lib/builder-packages-api.service.ts
export interface ZeApplicationConfig {
  application_uid: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_DOMAIN: string;
  BUILD_ID_ENDPOINT: string;
  EDGE_URL: string;
  DELIMITER: string;
  email: string;
  fetched_at?: number;
  jwt: string;
  PLATFORM: UploadProviderType;
  user_uuid: string;
  username: string;
  build_target: string;
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
