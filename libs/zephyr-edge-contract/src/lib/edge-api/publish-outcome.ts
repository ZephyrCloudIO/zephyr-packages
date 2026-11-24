/*
 * The permission-profile denial contract of the Zephyr API, copied by hand from its
 * OpenAPI components of the same names. Ids are uuids, except `IgnoredEnv.id`;
 * TypeScript cannot say so, so readers check them at runtime (zephyr-agent
 * `deploy-denied`).
 *
 * TODO(ZephyrCloudIO/zephyr-cloud-io#4591): generate these types from, or check them
 * against, the API's OpenAPI document at build time.
 */

/** A uuid and a display name. */
export interface NamedRef {
  id: string;
  name: string;
}

/** An environment the caller may not change: OpenAPI `DeniedEnvironment`. */
export interface DeniedEnvironment {
  environment: NamedRef & {
    type: 'production' | 'staging' | 'testing' | 'development' | 'other';
  };
  /**
   * Null when no profile exists yet, when the profile changed after the check, or when
   * the details of the environment could not be read.
   */
  profile: NamedRef | null;
  /**
   * Profile role the caller needs: `member` deploys, `maintainer` also changes settings
   * and deletes.
   */
  requiredRole: 'member' | 'maintainer';
  reason:
    | 'no_seat'
    | 'no_grant'
    | 'no_app_edit_role'
    | 'maintainer_required'
    | 'org_admin_required';
  /**
   * Up to 3 org owners and admins to ask for access. The 403 body still sends `name`; it
   * is leaving the contract (ZephyrCloudIO/zephyr-cloud-io#4541), so do not read it.
   */
  contacts: { id: string; name?: string }[];
  /** Org owners and admins beyond `contacts`; never negative. */
  moreContacts: number;
  /** Set when the environment follows a tag the write moves. */
  viaTag?: NamedRef;
}

/**
 * A denied environment in the upload response: OpenAPI `UploadDeniedEnvironment`.
 * Contacts are ids only, because CI logs can be public.
 */
export type UploadDeniedEnvironment = Omit<DeniedEnvironment, 'contacts'> & {
  contacts: { id: string }[];
};

/**
 * What an upload did with the app's tags and environments: OpenAPI `PublishOutcome`.
 * Present only while permission profiles are enforced for the org.
 */
export interface PublishOutcome {
  /** `denied`: the version is kept and no tag or environment of the app moved. */
  result: 'deployed' | 'denied';
  /** `snapshotId` is the edge snapshot key, not a uuid. */
  version: { id: string; snapshotId: string };
  /**
   * Each denied environment. An entry whose details could not be read is minimal (no
   * profile, `no_grant`, no contacts), and an environment with a non-uuid id is left out,
   * so decide from `result` and name the environments from `ignoredEnvs`.
   */
  denied: UploadDeniedEnvironment[];
}

/**
 * 403 body of a write refused for an environment's permission profile.
 *
 * TODO(ZephyrCloudIO/zephyr-cloud-io#4543): the body becomes RFC 9457 Problem Details
 * with `environments` as an extension member; `code` and `message` stay for one contract
 * version, then go.
 */
export interface EnvironmentDeniedResponse {
  code: 'ENVIRONMENT_DENIED';
  message: string;
  environments: DeniedEnvironment[];
}

/** An environment an upload did not move: OpenAPI `IgnoredEnv`. */
export interface IgnoredEnv {
  /**
   * Usually a uuid. The API also lists an environment with a non-uuid id here (a
   * hand-seeded row), which it leaves out of `PublishOutcome.denied`, although its
   * OpenAPI says `format: uuid`.
   */
  id: string;
  name: string;
  /**
   * Set while permission profiles are enforced. `denied`: the uploader may not deploy to
   * it. `held`: allowed, but not moved because another environment was denied.
   */
  reason?: 'locked' | 'protected' | 'denied' | 'held';
}

/** Response of the gateway's `/build-stats`. */
export interface BuildStatsResponse {
  status: string;
  message?: string;
  /** Published target URLs, when the plugin waits for deployments. */
  targets?: string[];
  outcome?: PublishOutcome;
  /** Environments the upload did not move. Sent with `outcome`. */
  ignoredEnvs?: IgnoredEnv[];
}
