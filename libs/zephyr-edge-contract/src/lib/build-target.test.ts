import { describe, expect, it } from '@rstest/core';
import { isZephyrBuildTarget, ZEPHYR_BUILD_TARGETS } from './build-target';

describe('ZephyrBuildTarget', () => {
  it('includes tap-app in the shared target contract', () => {
    expect(ZEPHYR_BUILD_TARGETS).toEqual(['web', 'ios', 'android', 'tap-app']);
    expect(isZephyrBuildTarget('tap-app')).toBe(true);
  });

  it('rejects unsupported target values', () => {
    expect(isZephyrBuildTarget('desktop')).toBe(false);
    expect(isZephyrBuildTarget(undefined)).toBe(false);
  });
});
