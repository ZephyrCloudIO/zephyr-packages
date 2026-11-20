/**
 * An environment the uploader may not deploy to, in the shape of the API's
 * `DeniedEnvironment` (zephyr-cloud-io #3987).
 */
export interface DeniedEnvironment {
  environment: {
    id: string;
    name: string;
    type: 'production' | 'staging' | 'testing' | 'development' | 'other';
  };
  /** Null only when no profile exists yet. */
  profile: { id: string; name: string } | null;
  /**
   * Profile role the uploader needs: `member` deploys, `maintainer` also changes
   * settings.
   */
  requiredRole: 'member' | 'maintainer';
  reason:
    | 'no_seat'
    | 'no_grant'
    | 'no_app_edit_role'
    | 'maintainer_required'
    | 'org_admin_required';
  /** Up to 3 org owners and admins to ask for access. */
  contacts: { id: string; name: string }[];
  /** Org owners and admins beyond `contacts`. */
  moreContacts: number;
  /** Set when the environment follows a tag the upload moves. */
  viaTag?: { id: string; name: string };
}

/**
 * What an upload did with the app's tags and environments (zephyr-cloud-io #4004).
 * Present only while permission profiles are enforced for the org.
 */
export interface PublishOutcome {
  /** `denied`: the version is kept and nothing of the app moved. */
  result: 'deployed' | 'denied';
  version: { id: string; snapshotId: string };
  /**
   * Each denied environment. An environment whose details the API could not read is left
   * out, so decide from `result`, not from this list.
   */
  denied: DeniedEnvironment[];
}

/** 403 body of a write refused for an environment's permission profile. */
export interface EnvironmentDeniedResponse {
  code: 'ENVIRONMENT_DENIED';
  message: string;
  environments: DeniedEnvironment[];
}

/** Response of the gateway's `/build-stats`. */
export interface BuildStatsResponse {
  status: string;
  /** Published target URLs, when the plugin waits for deployments. */
  targets?: string[];
  outcome?: PublishOutcome;
  /** Environments the upload did not move. Sent with `outcome`. */
  ignoredEnvs?: {
    id: string;
    name: string;
    reason?: 'locked' | 'protected' | 'denied' | 'held';
  }[];
}
