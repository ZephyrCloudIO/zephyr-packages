export const REPACK_NATIVE_BUILD_TARGETS = ['ios', 'android'] as const;

export type RepackNativeBuildTarget = (typeof REPACK_NATIVE_BUILD_TARGETS)[number];

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
 * Re.Pack produces React Native platform bundles. It cannot publish a generic TAP ESM
 * artifact, even when callers bypass TypeScript with plain JavaScript.
 */
export function assertRepackNativeBuildTarget(
  target: unknown,
  source = 'Re.Pack target'
): asserts target is RepackNativeBuildTarget {
  if (target === 'ios' || target === 'android') {
    return;
  }

  throw new TypeError(
    `${source} must be "ios" or "android"; received ${formatTarget(target)}. ` +
      'Re.Pack cannot publish tap-app artifacts.'
  );
}
