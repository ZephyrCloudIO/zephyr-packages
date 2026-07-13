export const METRO_NATIVE_BUILD_TARGETS = ['ios', 'android'] as const;

export type MetroNativeBuildTarget = (typeof METRO_NATIVE_BUILD_TARGETS)[number];

function formatTarget(target: unknown): string {
  if (target === undefined) {
    return 'undefined';
  }

  try {
    return JSON.stringify(target) ?? String(target);
  } catch {
    return `<${typeof target}>`;
  }
}

/**
 * Metro produces React Native platform bundles. It cannot publish a generic TAP ESM
 * artifact, even when callers bypass TypeScript with plain JavaScript.
 */
export function assertMetroNativeBuildTarget(
  target: unknown,
  source = 'Metro target'
): asserts target is MetroNativeBuildTarget {
  if (target === 'ios' || target === 'android') {
    return;
  }

  throw new TypeError(
    `${source} must be "ios" or "android"; received ${formatTarget(target)}. ` +
      'Metro cannot publish tap-app artifacts.'
  );
}
