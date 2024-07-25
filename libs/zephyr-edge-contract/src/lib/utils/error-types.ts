// ! If anyone is adding new errors to this file please make sure the description and debugging for users are sync with documentation's error page
export const docsPrefix = 'https://docs.zephyr-cloud.io/guide/error';

export type Prefix = 'ZE';

export type BuildErrorCode = `${Prefix}100${number}`;
export type DeployErrorCode = `${Prefix}200${number}`;
export type RuntimeErrorCode = `${Prefix}300${number}`;

type BuildErrorMessageType = {
  [T in BuildErrorCode]: string;
};
/**
 * A collection of error types and the error code during local/build stage*/
export const buildErrorMessages: BuildErrorMessageType = {
  /** package.json not found error */
  ZE10010: 'Package.json not found',
  /** Package.json is not in a valid json format*/
  ZE10011: 'Package.json is not in a valid json format.',
  /** Webpack config error*/
  ZE10012: 'Webpack config error.', // TODO: we don't detect this error yet, will we be able to separate them?
  /** Package.json must have a name and version field. */
  ZE10013: 'Package.json must have a name and version field.',
  /** Git remote origin is not configured properly.*/
  ZE10014: 'Git remote origin is not configured properly.',
  /** Git username or email is not configured. */
  ZE10015: 'Git username or email is not configured.',
  /** Could not get git info */
  ZE10016: 'Could not get git info.',
  /** application_uid missing. */
  ZE10017: '`application_uid` missing.',
  /** Auth error */
  ZE10018: 'Auth error.',
  /** Could not get build id. */
  ZE10019: 'Could not get build id.',
  /**Could not initialize Zephyr Agent. */
  ZE10020: 'Could not initialize Zephyr Agent.',
  /**Failed to get application hash list. */
  ZE10021: 'Failed to get application hash list.',
};

export type DeployErrorMessageType = {
  [T in DeployErrorCode]: string;
};

/** Happens when users are able to "deploy" -> there'd be edge url show up in their terminal. but when they click on that link it will show them this error. */
export const deployErrorMessages: DeployErrorMessageType = {
  /** Assets not found. */
  ZE20010: 'Assets not found.',
  /** Assets not found in snapshot. */
  ZE20011: 'Assets not found in snapshot.',
  /** `application_uid` is required. */
  ZE20012: '`application_uid` is required.',
  /** Missing file hash */
  ZE20013: 'Missing file hash.',
  /** Failed to load application configuration. */
  ZE20014: 'Failed to load application configuration.',
  /**Failed to upload build stats. */
  ZE20015: 'Failed to upload build stats.',
  /** Did not receive envs from build stats upload */
  ZE20016: 'Did not receive envs from build stats upload.',
  /** Failed to upload assets. */
  ZE20017: 'Failed to upload assets.',
  /** Failed to upload snapshots. */
  ZE20018: 'Failed to upload snapshots.',
  /** Snapshot uploads gave no results. */
  ZE20019: 'Snapshot uploads gave no results.',
  /**Failed to get application hash list */
  ZE20020: 'Failed to get application hash list.',
  /** Could not resolve ${name} with verson ${version} */
  ZE20021: 'Could not resolve application name with version.',
  /** Could not get build id */
  ZE20022: 'Could not get build id.',
};

export type RuntimeErrorMessageType = {
  [T in RuntimeErrorCode]: string;
};

export const runtimeErrorMessages: RuntimeErrorMessageType = {};

export type ErrorMessageMap = {
  buildErrorMessages: BuildErrorMessageType;
  deployErrorMessages: DeployErrorMessageType;
  runtimeErrorMessages: RuntimeErrorMessageType;
};

export const errorMessages: ErrorMessageMap = {
  buildErrorMessages,
  deployErrorMessages,
  runtimeErrorMessages,
};
