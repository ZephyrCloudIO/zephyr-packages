/** Categories for all error codes. */
export const ErrorCategories = {
  unknown: '00',
  build: '10',
  deploy: '20',
  browser: '30',
} as const satisfies {
  [name: string]: `${Digit}${Digit}`;
};

/** @deprecated */
export const Errors = {
  ERR_UNKNOWN: {
    id: '000',
    message:
      'Unknown error. Tell us about it in Discord https://zephyr-cloud.io/discord if you see this error',
    kind: 'unknown',
  },
  /** Package.json not found error */
  ERR_PACKAGE_JSON_NOT_FOUND: {
    id: '010',
    message: 'Package.json not found',
    kind: 'build',
  },
  /** Package.json is not in a valid json format */
  ERR_PACKAGE_JSON_NOT_VALID: {
    id: '011',
    message: 'Package.json is not in a valid json format.',
    kind: 'build',
  },
  /** Webpack config error */
  ERR_WEBPACK_CONFIG: {
    id: '012',
    message: 'Webpack config error.',
    kind: 'build',
  }, // TODO: we don't detect this error yet, will we be able to separate them?
  /** Package.json must have a name and version field. */
  ERR_PACKAGE_JSON_MUST_HAVE_NAME_VERSION: {
    id: '013',
    message: 'Package.json must have a name and version field.',
    kind: 'build',
  },
  /** Git remote origin is not configured properly. */
  ERR_GIT_REMOTE_ORIGIN: {
    id: '014',
    message: 'Git remote origin is not configured properly.',
    kind: 'build',
  },
  /** Git username or email is not configured. */
  ERR_NO_GIT_USERNAME_EMAIL: {
    id: '015',
    message: 'Git username or email is not configured.',
    kind: 'build',
  },
  /** Could not get git info */
  ERR_NO_GIT_INFO: {
    id: '016',
    message: 'Could not get git info.',
    kind: 'build',
  },
  /** Build error application_uid missing. */
  ERR_MISSING_APPLICATION_UID: {
    id: '017',
    message: '`application_uid` missing.',
    kind: 'build',
  },
  /** Auth error */
  ERR_AUTH_ERROR: {
    id: '018',
    message: 'Auth error.',
    kind: 'build',
  },
  /** Could not get build id. */
  ERR_GET_BUILD_ID: {
    id: '019',
    message: 'Could not get build id.',
    kind: 'build',
  },
  /** Could not initialize Zephyr Agent. */
  ERR_INITIALIZE_ZEPHYR_AGENT: {
    id: '020',
    message: 'Could not initialize Zephyr Agent.',
    kind: 'build',
  },
  /** Cloudflare specific error */
  ERR_UNABLE_CREATE_DIST_FOLDER: {
    id: '021',
    message: 'Error creating dist folder.',
    kind: 'build',
  },
  /** Deployment error, assets not found */
  ERR_ASSETS_NOT_FOUND: {
    id: '010',
    message: 'Assets not found.',
    kind: 'deploy',
  },
  /** Assets not found in snapshot */
  ERR_ASSETS_NOT_FOUND_IN_SNAPSHOT: {
    id: '011',
    message: 'Assets not found in snapshot.',
    kind: 'deploy',
  },
  /** Application_uid missing */
  ERR_DEPLOY_MISSING_APPLICATION_UID: {
    id: '012',
    message: '`application_uid` is required.',
    kind: 'deploy',
  },
  ERR_MISSING_FILE_HASH: {
    id: '013',
    message: 'Missing file hash.',
    kind: 'deploy',
  },
  /** Failed to load application configuration. */
  ERR_LOAD_APP_CONFIG: {
    id: '014',
    message: 'Failed to load application configuration.',
    kind: 'deploy',
  },
  /** Failed to upload build stats. */
  ERR_FAILED_UPLOAD_BUILD_STATS: {
    id: '015',
    message: 'Failed to upload build stats.',
    kind: 'deploy',
  },
  /** Did not receive envs from build stats upload */
  ERR_NOT_RECEIVE_ENVS_FROM_BUILD_STATS: {
    id: '016',
    message: 'Did not receive envs from build stats upload.',
    kind: 'deploy',
  },
  /** Failed to upload assets. */
  ERR_FAILED_UPLOAD_ASSETS: {
    id: '017',
    message: 'Failed to upload assets.',
    kind: 'deploy',
  },
  /** Failed to upload snapshots. */
  ERR_FAILED_UPLOAD_SNAPSHOTS: {
    id: '018',
    message: 'Failed to upload snapshots.',
    kind: 'deploy',
  },
  /** Snapshot uploads gave no results. */
  ERR_SNAPSHOT_UPLOADS_NO_RESULTS: {
    id: '019',
    message: 'Snapshot uploads gave no results.',
    kind: 'deploy',
  },
  /** Failed to get application hash list */
  ERR_GET_APPLICATION_HASH_LIST: {
    id: '020',
    message: 'Failed to get application hash list.',
    kind: 'deploy',
  },
  /** Could not resolve ${name} with verson ${version} */
  ERR_NOT_RESOLVE_APP_NAME_WITH_VERSION: {
    id: '021',
    message: 'Could not resolve application name with version.',
    kind: 'deploy',
  },
  ERR_SNAPSHOT_ID_NOT_FOUND: {
    id: '022',
    message: '`snapshot_id` not found.',
    kind: 'deploy',
  },
  ERR_SNAPSHOT_NOT_FOUND: {
    id: '023',
    message: 'Snapshot not found.',
    kind: 'deploy',
  },
  ERR_DEPLOY_LOCAL_BUILD: {
    id: '024',
    message: 'Failed to deploy local build.',
    kind: 'deploy',
  },
  /** Cloudflare specific error */
  ERR_WRANGLER_DEPENDENCY: {
    id: '025',
    message:
      'Wrangler dependency is needed for Cloudflare deployment. Please install dependencies without --no-optional flag.',
    kind: 'deploy',
  },
  ERR_CONVERT_GRAPH_TO_DASHBOARD: {
    id: '026',
    message: 'Failed to convert graph to dashboard data.',
    kind: 'browser',
  },
  ERR_UPLOAD_TO_CLOUDFLARE_PAGES: {
    id: '027',
    message: 'Error upload to cloudflare pages.',
    kind: 'deploy',
  },
  ERR_NO_WRANGLER: {
    id: '028',
    message:
      'Wrangler dependency is needed for Cloudflare deployment. Please install dependencies without --no-optional flag.',
    kind: 'build',
  },
  ERR_CREATE_DIST_FOLDER: {
    id: '029',
    message: 'Error creating dist folder.',
    kind: 'build',
  },
} as const satisfies {
  [name: string]: {
    id: `${Digit}${Digit}${Digit}`;
    message: string;
    kind: keyof typeof ErrorCategories;
  };
};

export type ZeErrors = {
  [K in keyof Errors]: ZeError<Categories[Errors[K]['kind']], Errors[K]['id']>;
}[keyof Errors];

type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Errors = typeof Errors;
type Categories = typeof ErrorCategories;
type ZeError<Category extends string, Code extends string> = `ZE${Category}${Code}`;
