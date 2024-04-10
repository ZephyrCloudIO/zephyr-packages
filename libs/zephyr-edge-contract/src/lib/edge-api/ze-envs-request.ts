export interface ZeUploadBuildStats {
  app_version: {
    application_uid: string;
    // version.app.repo.org - response from post-upload-snapshot
    snapshot_id: string;
  };

  // this is a key for wildcard serving of snapshot, it could be:
  // default url is `version.app.repo.org
  // tag: t_tag_name.app.repo.org - optional
  // env: e_env_name.app.repo.org - optional
  // cname: cname_value           - optional
  urls: string[];
  url_ids: string[];
  jwt: string;
}

export type ZeEnvs = ZeUploadBuildStats;
