export const ZEPHYR_BUILD_TARGETS = ['web', 'ios', 'android', 'tap-app'] as const;

export type ZephyrBuildTarget = (typeof ZEPHYR_BUILD_TARGETS)[number];

export function isZephyrBuildTarget(value: unknown): value is ZephyrBuildTarget {
  return (
    typeof value === 'string' &&
    (ZEPHYR_BUILD_TARGETS as readonly string[]).includes(value)
  );
}
