export interface UploadProviderConfig {
  type: UploadProviderType;
  providerConfig: IntegrationConfig;
}

export enum UploadProviderType {
  CLOUDFLARE = 'cloudflare',
  AWS = 'aws',
  NETLIFY = 'netlify',
  AZURE = 'azure',
  GCP = 'gcp',
}

export interface CloudflareOptions {
  edgeUrl: string;
  api_token: string;
  accountId: string;
  projectName?: string;
}

export type IntegrationConfig = CloudflareOptions;
