
// ! If anyone is adding new errors to this file please make sure the description and debugging for users are sync with documentation's error page
export const docsPrefix = "https://docs.zephyr-cloud.io/guide/error"

export declare enum ErrorCategories {
  /** "BU" is the prefix for errors happen during local development. This list will grow as we go.  */
  Build = 'BU',
  /** "DE" is the prefix for errors happen during deployment. */
  Deploy = 'DE',
  /** "RT" is the prefix for errors happen in runtime - sometimes they are not related to us and the debugging, error handling might be living in other framework, bundler, github issues etc.
   *
   * keeping it here to attach 'issues not related to us but it'd be nice of us to send them the potential workaround in the terminal.
   *
   * For now we haven't seen enough of this error reporting back. Unless we have the statistics from user, otherwise our docs related to this part would be empty*/
  Runtime = 'RT'
}




export type BuildErrorCode = `${ErrorCategories.Build}100${number}`
export type DeployErrorCode = `${ErrorCategories.Deploy}200${number}`
export type RuntimeErrorCode = `${ErrorCategories.Runtime}300${number}`

type BuildErrorMessageType = {
  [T in BuildErrorCode]: string
}
/**
 * A collection of error types and the error code during local/build stage*/
export const buildErrorMessages: BuildErrorMessageType = {
  /** package.json not found error */
  BU10010: "Package.json not found",
  /** Package.json is not in a valid json format*/
  BU10011: "Package.json is not in a valid json format.",
  /** Webpack config error*/
  BU10012: "Webpack config error.", // TODO: we don't detect this error yet, will we be able to separate them?
  /** Package.json must have a name and version field. */
  BU10013: "Package.json must have a name and version field.",
  /** Git remote origin is not configured properly.*/
  BU10014: "Git remote origin is not configured properly.",
  /** Git username or email is not configured. */
  BU10015: "Git username or email is not configured.",
  /** Could not get git info */
  BU10016: "Could not get git info.",
  /** application_uid missing. */
  BU10017: "`application_uid` missing.",
  /** Auth error */
  BU10018: "Auth error.",
  /** Could not get build id. */
  BU10019: "Could not get build id.",
  /**Could not initialize Zephyr Agent. */
  BU10020: "Could not initialize Zephyr Agent.",
  /**Failed to get application hash list. */
  BU10021: "Failed to get application hash list.",


}


export type DeployErrorMessageType = {
  [T in DeployErrorCode]: string
}

/** Happens when users are able to "deploy" -> there'd be edge url show up in their terminal. but when they click on that link it will show them this error. */
export const deployErrorMessages: DeployErrorMessageType = {
  /** Assets not found. */
  DE20010: "Assets not found.",
  /** Assets not found in snapshot. */
  DE20011: "Assets not found in snapshot.",
  /** `application_uid` is required. */
  DE20012: "`application_uid` is required.",
  /** Missing file hash */
  DE20013: "Missing file hash.",
  /** Failed to load application configuration. */
  DE20014: "Failed to load application configuration.",
  /**Failed to upload build stats. */
  DE20015: "Failed to upload build stats.",
  /** Did not receive envs from build stats upload */
  DE20016: "Did not receive envs from build stats upload.",
  /** Failed to upload assets. */
  DE20017: "Failed to upload assets.",
  /** Failed to upload snapshots. */
  DE20018: "Failed to upload snapshots.",
  /** Snapshot uploads gave no results. */
  DE20019: "Snapshot uploads gave no results.",
  /**Failed to get application hash list */
  DE20020: "Failed to get application hash list.",
  /** Could not resolve ${name} with verson ${version} */
  DE20021: "Could not resolve application name with version.",
  /** Could not get build id */
  DE20022: "Could not get build id."
}



export type RuntimeErrorMessageType = {
  [T in RuntimeErrorCode]: string
}

export const runtimeErrorMessages: RuntimeErrorMessageType = {

}

export type ErrorMessageMap = {
  buildErrorMessages: BuildErrorMessageType,
  deployErrorMessages: DeployErrorMessageType,
  runtimeErrorMessages: RuntimeErrorMessageType
}

export const errorMessages: ErrorMessageMap = {
  buildErrorMessages,
  deployErrorMessages,
  runtimeErrorMessages
}

