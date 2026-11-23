export const ZEPHYR_BUILD_TARGETS = [
  'web',
  'ios',
  'android',
  'tap-app',
  'worker',
] as const;

export type ZephyrBuildTarget = (typeof ZEPHYR_BUILD_TARGETS)[number];

export type ZephyrBundlerBuildTarget = Exclude<ZephyrBuildTarget, 'worker'>;

function isBundlerBuildTarget(
  target: ZephyrBuildTarget
): target is ZephyrBundlerBuildTarget {
  return target !== 'worker';
}

/**
 * Targets that bundler plugins (webpack, rspack, vite, metro, ...) can publish. `worker`
 * is accepted by ze-cli only, so it is deliberately absent here.
 */
export const ZEPHYR_BUNDLER_BUILD_TARGETS: readonly ZephyrBundlerBuildTarget[] =
  ZEPHYR_BUILD_TARGETS.filter(isBundlerBuildTarget);

export function isZephyrBuildTarget(value: unknown): value is ZephyrBuildTarget {
  return (
    typeof value === 'string' &&
    (ZEPHYR_BUILD_TARGETS as readonly string[]).includes(value)
  );
}

/**
 * Enforce the public build-target contract at JavaScript entry points as well as in
 * TypeScript callers. Adapter options can come from untyped config files, so a type
 * annotation alone is not enough to prevent an unsupported target from being published.
 */
export function assertZephyrBuildTarget(
  value: unknown,
  optionName = 'target'
): asserts value is ZephyrBuildTarget {
  if (isZephyrBuildTarget(value)) {
    return;
  }

  const received = typeof value === 'string' ? JSON.stringify(value) : String(value);
  throw new TypeError(
    `${optionName} must be one of ${ZEPHYR_BUILD_TARGETS.join(', ')}; received ${received}.`
  );
}

/** Message shared by every bundler plugin when it is given the `worker` target. */
function formatWorkerBundlerTargetError(optionName: string): string {
  return `${optionName} does not support "worker" in bundler plugins. Publish worker builds with ze-cli (ze-cli deploy <directory> --target worker). Worker support in bundler plugins may come later.`;
}

/**
 * Bundler plugins must not accept the `worker` target: worker artifacts are published
 * with ze-cli only. Use this guard instead of {@link assertZephyrBuildTarget} at plugin
 * entry points, so untyped config files cannot sneak `worker` past the type narrowing.
 */
export function assertZephyrBundlerBuildTarget(
  value: unknown,
  optionName = 'target'
): asserts value is ZephyrBundlerBuildTarget {
  if (value === 'worker') {
    throw new TypeError(formatWorkerBundlerTargetError(optionName));
  }

  if (
    typeof value === 'string' &&
    (ZEPHYR_BUNDLER_BUILD_TARGETS as readonly string[]).includes(value)
  ) {
    return;
  }

  const received = typeof value === 'string' ? JSON.stringify(value) : String(value);
  throw new TypeError(
    `${optionName} must be one of ${ZEPHYR_BUNDLER_BUILD_TARGETS.join(', ')}; received ${received}.`
  );
}
