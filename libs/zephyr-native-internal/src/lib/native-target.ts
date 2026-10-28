export const NATIVE_BUILD_TARGETS = ['ios', 'android'] as const;

export type NativeBuildTarget = (typeof NATIVE_BUILD_TARGETS)[number];

const BUNDLER_LABELS = { metro: 'Metro', repack: 'Re.Pack' } as const;

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
 * Metro and Re.Pack produce React Native platform bundles; neither can publish a TAP ESM
 * artifact, even when plain-JS callers bypass TypeScript.
 */
export function assertNativeBuildTarget(
  target: unknown,
  source: string,
  bundler: 'metro' | 'repack'
): asserts target is NativeBuildTarget {
  if (target === 'ios' || target === 'android') {
    return;
  }

  throw new TypeError(
    `${source} must be "ios" or "android"; received ${formatTarget(target)}. ${BUNDLER_LABELS[bundler]} cannot publish tap-app artifacts.`
  );
}
