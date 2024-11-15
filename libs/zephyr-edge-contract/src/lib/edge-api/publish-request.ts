export interface PublishTarget {
  url: string;
  hostname: string;
}

// TODO: all tags, envs, cname publish targets should be logged in deployment history
export interface PublishTargets {
  /**
   * `undefined` for rollback request, otherwise `PublishTarget`
   *
   * Already published at this point
   */
  version?: PublishTarget;
  // publish each below
  tags: PublishTarget[];
  envs: PublishTarget[];
  cnames: PublishTarget[];
}

export interface GatewayPublishRequest {
  EDGE_URL: string;
  application_uid: string;
  snapshot_id: string;
  targets: PublishTargets;
  /** Previously `can_write_jwt` */
  jwt: string;
}

export interface StageZeroPublishRequest {
  application_uid: string;
  snapshot_id: string;
  targets: PublishTarget[];
}

export interface PublishRequest {
  EDGE_URL: string;
  application_uid: string;
  app_version: {
    snapshot_id?: string;
  };
  snapshot_id?: string;
  user_uuid: string;
  username: string;
  can_write: boolean;

  // TODO: all tags, envs, cname publish targets should be logged in deployment history
  targets: {
    // already published at this point
    version: PublishTarget;
    // publish each below
    tags: PublishTarget[];
    envs: PublishTarget[];
    cnames: PublishTarget[];
  };

  // this is can_write_jwt
  jwt: string;
}
