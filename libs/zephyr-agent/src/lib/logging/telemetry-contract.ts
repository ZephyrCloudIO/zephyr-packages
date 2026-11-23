/**
 * Names shared with the Zephyr worker for structured logs and request correlation. Both
 * sides must use these exact strings; change them only together with the worker.
 */

/** Request header carrying the resolved build ID (the same value as `zeBuildId`). */
export const ZE_BUILD_ID_HEADER = 'x-ze-build-id';

/** Product token that starts every agent `User-Agent`. */
export const ZE_USER_AGENT_PRODUCT = 'zephyr-agent';

/** Snake_case field names used inside a remote log event's `data` group. */
export const ZeLogFields = {
  BUILD_ID: 'build_id',
  FILE_NAME: 'file_name',
  SIZE_BYTES: 'size_bytes',
  DURATION_MS: 'duration_ms',
  BYTES: 'bytes',
  ASSETS_UPLOADED: 'assets_uploaded',
  ASSETS_TOTAL: 'assets_total',
  OUTCOME: 'outcome',
} as const;

/**
 * Dotted attribute names for traces and log indexes. A log event field maps to an
 * attribute through {@linkcode ZE_LOG_FIELD_ATTRIBUTES}.
 */
export const ZephyrAttributes = {
  APPLICATION_UID: 'zephyr.application.uid',
  BUILD_ID: 'zephyr.build.id',
  BUILD_BUILDER: 'zephyr.build.builder',
  BUILD_SNAPSHOT_ID: 'zephyr.build.snapshot_id',
  BUILD_PLUGIN: 'zephyr.build.plugin',
  BUILD_PLUGIN_VERSION: 'zephyr.build.plugin_version',
  AGENT_VERSION: 'zephyr.agent.version',
  GIT_COMMIT: 'zephyr.git.commit',
  GIT_BRANCH: 'zephyr.git.branch',
  IS_CI: 'zephyr.is_ci',
  CORRELATION_ID: 'zephyr.correlation.id',
  ASSET_NAME: 'zephyr.asset.name',
  ASSET_SIZE_BYTES: 'zephyr.asset.size_bytes',
  UPLOAD_OUTCOME: 'zephyr.upload.outcome',
} as const;

export type ZephyrAttributeName =
  (typeof ZephyrAttributes)[keyof typeof ZephyrAttributes];

/** How a remote log event's fields map to attribute names, keyed by `group.field`. */
export const ZE_LOG_FIELD_ATTRIBUTES = {
  application_uid: ZephyrAttributes.APPLICATION_UID,
  zeBuildId: ZephyrAttributes.BUILD_ID,
  'git.commit': ZephyrAttributes.GIT_COMMIT,
  'git.branch': ZephyrAttributes.GIT_BRANCH,
  'context.builder': ZephyrAttributes.BUILD_BUILDER,
  'context.plugin': ZephyrAttributes.BUILD_PLUGIN,
  'context.plugin_version': ZephyrAttributes.BUILD_PLUGIN_VERSION,
  'context.agent_version': ZephyrAttributes.AGENT_VERSION,
  'context.ci': ZephyrAttributes.IS_CI,
  'data.file_name': ZephyrAttributes.ASSET_NAME,
  'data.size_bytes': ZephyrAttributes.ASSET_SIZE_BYTES,
  'data.outcome': ZephyrAttributes.UPLOAD_OUTCOME,
} as const satisfies Record<string, ZephyrAttributeName>;
