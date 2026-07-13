import { describe, expect, it } from '@rstest/core';
import {
  assertZephyrBuildTarget,
  isZephyrBuildTarget,
  ZEPHYR_BUILD_TARGETS,
} from './build-target';

describe('ZephyrBuildTarget', () => {
  it('includes tap-app in the shared target contract', () => {
    expect(ZEPHYR_BUILD_TARGETS).toEqual(['web', 'ios', 'android', 'tap-app']);
    expect(isZephyrBuildTarget('tap-app')).toBe(true);
  });

  it('rejects unsupported target values', () => {
    expect(isZephyrBuildTarget('desktop')).toBe(false);
    expect(isZephyrBuildTarget(undefined)).toBe(false);
  });

  it('fails fast when an untyped public option supplies an unsupported target', () => {
    expect(() => assertZephyrBuildTarget('desktop', 'withZephyr({ target })')).toThrow(
      'withZephyr({ target }) must be one of web, ios, android, tap-app; received "desktop".'
    );
  });
});
