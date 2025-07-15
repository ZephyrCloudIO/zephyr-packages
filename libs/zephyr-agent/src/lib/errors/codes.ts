type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Categories for all error codes. */
export const ZeErrorCategories = {
  /** Error we have yet catched and known */
  unknown: '00',
  /** Stage 0 build error */
  build: '10',
  /** Stage 1 Deployment error */
  deploy: '20',
  /** Browser error */
  browser: '30',
  /** Module Federation/Config related error */
  config: '40',
} as const satisfies {
  [name: string]: `${Digit}${Digit}`;
};

/**
 * A collection of error types and the error code during local/build stage
 *
 * If you are searching for an error globally, if it is a build related error, it starts
 * with `ZE10`, if it's a deployment related error, search for `ZE20` and then followed
 * with their ID.
 *
 * - `ZE` at the front is a constant
 * - Two digits at the middle PP (`10` for build error or `20` for deployment error) is
 *   their categories,
 * - Last three digits is their ID.
 *
 * For example, if you have a `SNAPSHOT_NOT_FOUND` error, search for `ZE20023`, if you see
 * an error showing up on terminal or application, the last three numbers are their IDs.
 * We might extend to have more errors in the future.
 */
export const ZeErrors = {
  ERR_UNKNOWN: {
    id: '000',
    message: `
Unknown error: {{ message }}

`,
    kind: 'unknown',
  },

  /** Package.json not found error */
  // TODO: this error is less likely to happen
  ERR_PACKAGE_JSON_NOT_FOUND: {
    id: '010',
    message: 'package.json not found',
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
  },

  ERR_PACKAGE_JSON_MUST_HAVE_NAME_VERSION: {
    id: '013',
    message:
      'Zephyr need package.json to have name and version field to map your application configuration in deployment. Please ensure these fields exists in your package.json.',
    kind: 'build',
  },

  ERR_GIT_REMOTE_ORIGIN: {
    id: '014',
    message: `
Could not detect a git remote called 'origin'. This is required for Zephyr to work properly.

Please set the git remote origin by running the following command:

\`\`\`sh
git init
git remote add origin <url>
\`\`\`
`,
    kind: 'build',
  },

  /** Git username or email is not configured. */
  ERR_NO_GIT_USERNAME_EMAIL: {
    id: '015',
    message: `
Git username or email is not configured:
- please set valid 'git config user.name' and 'git config user.email'
- or provide ZE_USER_TOKEN as environment variable
`,
    kind: 'build',
  },

  /** Could not get git info */
  ERR_NO_GIT_INFO: {
    id: '016',
    message: `

Failed to load git information:

{{ message }}

`,
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
    message: `
Failed to authenticate with Zephyr.

Please make sure you have a valid Zephyr account and you are logged in.

{{ message }}
`,
    kind: 'build',
  },

  ERR_GET_BUILD_ID: {
    id: '019',
    message: `
Could not generate Build ID. Ensure you meet the following requirements:

1. Your Zephyr Account ({{ username }}) has write access to {{ application_uid }}
2. You own the repository or is a collaborator with write access.
3. This repository has commit history and has a proper git remote origin url.

When trying out public examples, make sure to fork the repository to your account so you can have write access.

`,
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

  /** Auth forbidden error */
  ERR_AUTH_FORBIDDEN_ERROR: {
    id: '022',
    message: `
User not allowed to access the requested resource.

Please make sure you are logged in with the correct Zephyr account.

{{ message }}
`,
    kind: 'build',
  },

  /**
   * Module federation configuraiton error, throw full stop if configuration is invalid -
   * specifically for React Native.
   *
   * Reference:
   * https://github.com/web-infra-dev/rspack/blob/5848d8bbb0434409aab33a4c677eb2afb52c5564/crates/rspack_plugin_library/src/assign_library_plugin.rs#L222
   */
  ERR_INVALID_MF_CONFIG: {
    id: '023',
    message: `Library name {{library_name}} must be a valid identifier when using "var" as library type in Module Federation configuration. Either use a valid identifier (e. g. {base_identifier}) or use a different library type (e. g. type: 'global', which assign a property on the global scope instead of declaring a variable). To see a list of valid identifiers, please refer to:
- Mozilla's documentation on identifiers: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#identifiers
- The list of Module Federation's available library type: https://github.com/module-federation/core/blob/ae5ee1eedad4565774ea82e30b3d0df7c9921c58/webpack/declarations/WebpackOptions.d.ts#L112

You can change the library name to CamelCase to avoid this error.`,
    kind: 'build',
  },

  ERR_INVALID_APP_ID: {
    id: '024',
    message: `Invalid application_uid: {{application_uid}}. Your application_uid is a combination of:
- git organization name
- git user name
- name in package.json (They should be the same in your Module Federation configuration if there is any).
Please make sure you have set them correctly in your package.json and git repository. The application_uid will be used to assign subdomain for your application. Read more about the standard of what characters are allowed in domain names in IETF: https://datatracker.ietf.org/doc/html/rfc1035#:~:text=The%20labels%20must%20follow%20the%20rules%20for%20ARPANET%20host%20names.%20%20They%20must%0Astart%20with%20a%20letter%2C%20end%20with%20a%20letter%20or%20digit%2C%20and%20have%20as%20interior%0Acharacters%20only%20letters%2C%20digits%2C%20and%20hyphen.%20%20There%20are%20also%20some%0Arestrictions%20on%20the%20length.%20%20Labels%20must%20be%2063%20characters%20or%20less.`,
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
    message: `

Failed to load Application Configuration for {{ application_uid }}.

Try to remove ~/.zephyr folder and try again.

    `,
    kind: 'deploy',
  },

  /** Did not receive envs from build stats upload */
  ERR_NOT_RECEIVE_ENVS_FROM_BUILD_STATS: {
    id: '016',
    message: 'Did not receive envs from build stats upload.',
    kind: 'deploy',
  },

  /** Failed to upload assets. */
  ERR_FAILED_UPLOAD: {
    id: '017',
    message: `

Could not upload {{ type }} to your Edge Provider. This error will affect your tags and environments and it might fail deployments to custom domains.

Please check your network connection and try again.

    `,
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
    message: `
Failed to deploy local build.

{{ message }}
  `,
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
    message: `
Failed to convert federation configuration to needed information. We are reading your Module Federation configuration to understand your shared dependencies:

- host application's name
- remote application's name
- shared dependencies.

Please refer to the official Module Federation guide https://module-federation.io/configure/index.html to make sure your have required inputs.
`,
    kind: 'browser',
  },

  ERR_UPLOAD_TO_CLOUDFLARE_PAGES: {
    id: '027',
    message: 'Error upload to Cloudflare pages.',
    kind: 'deploy',
  },

  ERR_USER_IDENTITY: {
    id: '036',
    message: `
Git username or email is not configured
  - please set valid 'git config user.name' and 'git config user.email'
  - or provide ZE_USER_TOKEN as environment variable
`,
    kind: 'deploy',
  },

  ERR_TLS_CERT_ALTNAME_INVALID: {
    id: '034',
    message:
      "You domain's TLS Certificate is invalid. Have you updated your domain settings with your Registrar?",
    kind: 'deploy',
  },

  ERR_HTTP_ERROR: {
    id: '035',
    message: `

HTTP request for {{ method }} {{ url }} failed with status code {{ status }}.

Please check your network connection and try again.

{{ content }}

`,
    kind: 'config',
  },

  ERR_NO_WRANGLER: {
    id: '028',
    message: `Wrangler is not installed. It's needed for Cloudflare deployment. Please install dependencies without --no-optional flag.`,
    kind: 'build',
  },

  ERR_CREATE_DIST_FOLDER: {
    id: '029',
    message: `Error on creating dist folder. Zephyr is unable to create dist folder for your application's configuration.`,
    kind: 'build',
  },

  /**
   * This case needs to be specific without a message as the server respond with 40*, so
   * we will need to prioritize the server status code and prints out the status
   *
   * @example
   *   {
   *     "statusCode": 401,
   *     "timestamp": "2024-08-23T02:21:48.873Z",
   *     "path": "/v2/builder-packages-api/application-config?application-uid=home-spa.federated_apps.zmzlois"
   *   }
   */
  ERR_NO_RESPONSE_FOR_APP_CONFIG: {
    id: '030',
    message: 'Failed to load application configuration.',
    kind: 'build',
  },

  ERR_NO_JWT: {
    id: '031',
    message: `You don't have valid JWT token. Try to log out from the dashboard and log in again. https://app.zephyr-cloud.io`,
    kind: 'build',
  },

  ERR_JWT_INVALID: {
    id: '032',
    message:
      'Your JWT token is invalid. Try to log out from the dashboard and log in again. https://app.zephyr-cloud.io',
    kind: 'build',
  },

  ERR_WEBSOCKET_CONNECTION: {
    id: '034',
    message: 'Websocket connection error during login.',
    kind: 'build',
  },

  ERR_GET_APP_CONFIG: {
    id: '035',
    message:
      'Error when getting application configuration from API. Could not find application configuration. Please try again after removing ~/.zephyr folder.',
    kind: 'build',
  },

  ERR_GIT_COMMIT_HASH: {
    id: '036',
    message:
      'Failed to get git commit hash. Can you make sure this git repository has commit history?',
    kind: 'build',
  },

  ERR_RESOLVE_REMOTES: {
    id: '001',
    message: `
Failed to resolve remote dependency: {{ appUid }} version {{ version }}

This could be due to one of the following reasons:
- The remote application '{{ appName }}' has not been built with Zephyr yet
- The specified version '{{ version }}' does not exist
- You don't have access to this application
- The application exists but no environment has been created

Steps to resolve:
1. Ensure the remote application is built with Zephyr first
2. For newly created applications, create an environment:
   - Go to https://app.zephyr-cloud.io
   - Navigate to your application
   - Create a new environment (e.g., "development" or "production")
3. Check that the version exists by visiting the dashboard
4. Verify you have access to {{ orgName }}/{{ projectName }}/{{ appName }}
5. If you need any version, use "*" as the version in zephyr:dependencies

Expected behavior:
- Remote applications must be built and deployed before they can be consumed
- Applications must have at least one environment created
- Version must match an existing build (use "*" for latest)
- When using "*", at least one version must exist in the application
- You must have read access to the remote application

Application UID format: [app_name].[project_name].[org_name]
Example: "my-remote.my-project.my-org"

`,
    kind: 'config',
  },

  ERR_CANNOT_RESOLVE_APP_NAME_WITH_VERSION: {
    id: '003',
    message: `
Failed to resolve remote application with version {{ version }}

This could be due to one of the following reasons:
- Network error while trying to resolve the dependency
- Zephyr API is temporarily unavailable
- Application naming mismatch in configuration

Steps to resolve:
1. Check your network connection
2. If using "*" version, ensure at least one version exists
3. Ensure the application has an environment created in the dashboard

Expected behavior:
- Remote application must have at least one deployed version
- Application must have at least one environment

Application naming is based on:
- git organization/username
- git repository name
- name in package.json

For debugging, check:
- Your ~/.zephyr folder for cached tokens
- Network proxy settings if behind corporate firewall
- API status at https://status.zephyr-cloud.io

Documentation: https://docs.zephyr-cloud.io/how-to/mf-guide
      `,
    kind: 'config',
  },
  ERR_SHARED_PACKAGE: {
    id: '004',
    message: `
Were the required packages in Module federation plugin installed and included in package.json? We had error while trying to compute your shared dependencies.`,
    kind: 'config',
  },

  ERR_MF_CONFIG_MISSING_FILENAME: {
    id: '005',
    message:
      'Missing filename in Module Federation configuration. Since the filename in React Native is the actual JS bundle, input of filename in Module Federation configuration is required.',
    kind: 'config',
  },
  ERR_MISSING_METRO_FEDERATION_CONFIG: {
    id: '037',
    message:
      'Missing Metro Federation configuration. Please ensure the configuration is correctly set in your project.',
    kind: 'config',
  },
  ERR_MISSING_PLATFORM: {
    id: '006',
    message:
      'Missing platform target (ios, android or others) from compiler options. Please open an issue on https://github.com/ZephyrCloudIO/zephyr-packages/issues',
    kind: 'config',
  },
} as const satisfies {
  [name: string]: {
    /** Error id. See ErrorCategories to understand prefix */
    id: `${Digit}${Digit}${Digit}`;
    /** Error message */
    message: string;
    /** @internal What type of error it is - indicate by id */
    kind: keyof typeof ZeErrorCategories;
  };
};

/** Error object for Zephyr errors. */
export type ZeErrors = typeof ZeErrors;

/** `"ERR_UNKNOWN"`, `"ERR_PACKAGE_JSON_NOT_FOUND"` ... */
export type ZeErrorKeys = keyof ZeErrors;

/** `ZeErrors.ERR_UNKNOWN`, `ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND` ... */
export type ZeErrorType = ZeErrors[ZeErrorKeys];

/** Builds a Zephyr error code from a given error type. */
export type ZeErrorCode<K extends ZeErrorKeys> =
  `ZE${(typeof ZeErrorCategories)[ZeErrors[K]['kind']]}${ZeErrors[K]['id']}`;

/** `"ZE00000"`, `"ZE10010"` ... */
export type ZeErrorCodes = { [K in ZeErrorKeys]: ZeErrorCode<K> }[ZeErrorKeys];

/** Ensures `a` and `b` are the same error type. */
export function isZeErrorEqual(a: ZeErrorType, b: ZeErrorType) {
  return a.id === b.id && a.kind === b.kind;
}
