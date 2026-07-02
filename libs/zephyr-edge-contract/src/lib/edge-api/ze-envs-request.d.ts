export interface ZeUploadBuildStats {
  app_version: {
    application_uid: string;
    snapshot_id: string;
  };
  urls: string[];
  url_ids: string[];
  jwt: string;
}
export type ZeEnvs = ZeUploadBuildStats;
