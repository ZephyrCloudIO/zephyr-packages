export const ZEPHYR_BUILD_TARGETS = ['web', 'ios', 'android', 'tap-app'] as const;

export type ZephyrBuildTarget = (typeof ZEPHYR_BUILD_TARGETS)[number];

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
