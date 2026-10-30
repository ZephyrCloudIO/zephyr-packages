/** Secret-free requirements. Resource identities and values are owned by the environment. */
export interface CloudflareDeploymentBinding {
  name: string;
  type: 'd1' | 'r2_bucket' | 'kv_namespace' | 'images' | 'plain_text';
}

export interface CloudflareDeployment {
  schemaVersion: 1;
  compatibilityDate: string;
  compatibilityFlags: string[];
  bindings: CloudflareDeploymentBinding[];
  assets: {
    binding: string;
    directory: string;
    runWorkerFirst: boolean | string[];
    htmlHandling?: string;
    notFoundHandling?: string;
  };
  crons: string[];
}
