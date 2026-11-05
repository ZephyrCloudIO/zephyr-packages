import type { ZephyrManifest } from '../zephyr-manifest';

export interface PublishTarget {
  url: string;
  hostname: string;
  zephyrManifestFile?: {
    content: ZephyrManifest;
    hash: string;
  };
}

/** The control plane records every version, tag, environment, and CNAME target. */
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
  /** Per-environment variables - map of hostname to variables for all deploys */
  envVarSetEnvMap?: Record<string, Record<string, string>>;
  /**
   * RS256 JWT signed by the Zephyr API (token_use=zephyr_publish_grant). The edge writes
   * only hostnames listed in the grant.
   */
  publishGrant?: string;
  /**
   * RS256 JWTs signed by the Zephyr API (token_use=zephyr_publish_grant), one per edge
   * destination. The edge writes only hostnames listed in the grant.
   */
  publishGrants?: string[];
}

export interface StageZeroPublishRequest {
  application_uid: string;
  snapshot_id: string;
  targets: PublishTarget[];
  /** Per-environment variables - map of hostname to variables for all deploys */
  environmentVariables?: Record<string, Record<string, string>>;
  /**
   * RS256 JWT signed by the Zephyr API (token_use=zephyr_publish_grant). The edge writes
   * only hostnames listed in the grant.
   *
   * The edge receives one grant per request.
   */
  publishGrant?: string;
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

  /** Target categories are intentionally transmitted together for one publication. */
  targets: {
    // already published at this point
    version: PublishTarget;
    // publish each below
    tags: PublishTarget[];
    envs: PublishTarget[];
    cnames: PublishTarget[];
  };
  envVarsHash?: string;
  environmentVariables?: Record<string, Record<string, string>>;

  // this is can_write_jwt
  jwt: string;

  /**
   * RS256 JWT signed by the Zephyr API (token_use=zephyr_publish_grant). The edge writes
   * only hostnames listed in the grant.
   */
  publishGrant?: string;
  /**
   * RS256 JWTs signed by the Zephyr API (token_use=zephyr_publish_grant), one per edge
   * destination. The edge writes only hostnames listed in the grant.
   */
  publishGrants?: string[];
}

/** Value of the `token_use` claim that marks a JWT as a publish grant. */
export type PublishGrantTokenUse = 'zephyr_publish_grant';

/**
 * Claims the Zephyr API signs into a publish grant. A grant names exactly what one
 * publish may change, so the edge does not trust destinations built by clients.
 */
export interface PublishGrantClaims {
  token_use: PublishGrantTokenUse;
  /** Unique grant id, used for replay protection. */
  jti: string;
  /** Issued-at time in seconds since epoch. */
  iat?: number;
  /** Expiry time in seconds since epoch. */
  exp: number;
  /** Actor uid the API allowed to publish. */
  sub?: string;
  application_uid: string;
  snapshot_id: string;
  /** Exact hostnames the API allowed for this publish. */
  hostnames: string[];
  /** Edge origin the gateway must publish to. */
  edge_url: string;
}
