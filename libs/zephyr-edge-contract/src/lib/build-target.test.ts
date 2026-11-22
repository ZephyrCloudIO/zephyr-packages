// BDD description (unit tests are generated from this description):
//
// Feature: Public build-target contract
//
//   Scenario: the shared contract lists every publishable target
//     Given the ZEPHYR_BUILD_TARGETS list
//     Then it contains web, ios, android, tap-app and worker
//     And isZephyrBuildTarget accepts each of them
//
//   Scenario: unsupported values are rejected by both guards
//     Given desktop, undefined, an empty string, "WORKER" or 42
//     Then isZephyrBuildTarget returns false
//     And assertZephyrBundlerBuildTarget throws without advertising worker
//
//   Scenario: bundler plugins accept the four legacy targets
//     Given web, ios, android or tap-app
//     Then assertZephyrBundlerBuildTarget does not throw
//
//   Scenario: bundler plugins reject worker
//     Given the worker target
//     Then assertZephyrBundlerBuildTarget throws a TypeError
//     And the message names the option, ze-cli, "--target worker" and "may come later"
import { describe, expect, it } from '@rstest/core';
import {
  assertZephyrBuildTarget,
  assertZephyrBundlerBuildTarget,
  formatWorkerBundlerTargetError,
  isZephyrBuildTarget,
  ZEPHYR_BUILD_TARGETS,
  ZEPHYR_BUNDLER_BUILD_TARGETS,
} from './build-target';

function messageOf(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
}

describe('ZephyrBuildTarget', () => {
  it('lists every publishable target including worker', () => {
    expect(ZEPHYR_BUILD_TARGETS).toEqual(['web', 'ios', 'android', 'tap-app', 'worker']);
    expect(isZephyrBuildTarget('tap-app')).toBe(true);
    expect(isZephyrBuildTarget('worker')).toBe(true);
  });

  it('keeps the bundler list equal to the public list minus worker', () => {
    expect(ZEPHYR_BUNDLER_BUILD_TARGETS).toEqual(
      ZEPHYR_BUILD_TARGETS.filter((target) => target !== 'worker')
    );
  });

  it('rejects unsupported target values', () => {
    for (const value of ['desktop', undefined, '', 'WORKER', 42, null]) {
      expect(isZephyrBuildTarget(value)).toBe(false);
    }
  });

  it('fails fast when an untyped public option supplies an unsupported target', () => {
    expect(() => assertZephyrBuildTarget('desktop', 'withZephyr({ target })')).toThrow(
      'withZephyr({ target }) must be one of web, ios, android, tap-app, worker; received "desktop".'
    );
  });
});

describe('assertZephyrBundlerBuildTarget', () => {
  it('accepts the four legacy targets', () => {
    for (const target of ['web', 'ios', 'android', 'tap-app']) {
      expect(() => assertZephyrBundlerBuildTarget(target)).not.toThrow();
    }
  });

  it('rejects unsupported values without advertising worker', () => {
    for (const value of ['desktop', undefined, '', 'WORKER', 42]) {
      const run = () => assertZephyrBundlerBuildTarget(value, 'withZephyr({ target })');
      expect(run).toThrow(TypeError);
      const message = messageOf(run);
      expect(message).toContain('must be one of web, ios, android, tap-app; received');
      expect(message).not.toContain('worker');
    }
  });

  it('rejects worker with a message that points to ze-cli', () => {
    const run = () => assertZephyrBundlerBuildTarget('worker', 'withZephyr({ target })');
    expect(run).toThrow(TypeError);
    const message = messageOf(run);
    expect(message).toBe(formatWorkerBundlerTargetError('withZephyr({ target })'));
    expect(message).toContain('withZephyr({ target })');
    expect(message).toContain('ze-cli');
    expect(message).toContain('--target worker');
    expect(message).toContain('may come later');
  });

  it('defaults the option name to target', () => {
    expect(() => assertZephyrBundlerBuildTarget('worker')).toThrow(
      /^target does not support/
    );
  });
});
