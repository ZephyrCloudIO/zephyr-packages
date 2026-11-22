// BDD description (unit tests are generated from this description):
//
// Feature: native bundler target guard (Metro and Re.Pack)
//
//   Scenario: native platforms are accepted
//     Given the target is "ios" or "android"
//     Then assertNativeBuildTarget does not throw
//
//   Scenario: the worker target is rejected with ze-cli guidance
//     Given the target is "worker"
//     Then a TypeError is thrown that names the source, ze-cli and "may come later"
//     And the message is the same for Metro and Re.Pack
//
//   Scenario: tap-app keeps its dedicated message
//     Given the target is "tap-app"
//     Then the error says the bundler cannot publish tap-app artifacts
//
//   Scenario: invalid values are rejected
//     Given undefined, a number, an unknown string, an object or a circular object
//     Then a TypeError says the target must be "ios" or "android"
//
// These tests are generated from the description above.
import { describe, expect, it } from '@rstest/core';
import { assertNativeBuildTarget } from './native-target';

function messageOf(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
}

describe('assertNativeBuildTarget', () => {
  it('accepts ios and android', () => {
    expect(() =>
      assertNativeBuildTarget('ios', 'withZephyr({ target })', 'metro')
    ).not.toThrow();
    expect(() =>
      assertNativeBuildTarget('android', 'withZephyr({ target })', 'repack')
    ).not.toThrow();
  });

  it('rejects worker and points to ze-cli for both bundlers', () => {
    for (const bundler of ['metro', 'repack'] as const) {
      const run = () =>
        assertNativeBuildTarget('worker', 'withZephyr({ target })', bundler);
      expect(run).toThrow(TypeError);
      const message = messageOf(run);
      expect(message).toContain('withZephyr({ target }) does not support "worker"');
      expect(message).toContain('ze-cli');
      expect(message).toContain('may come later');
    }
  });

  it('keeps the tap-app message', () => {
    const message = messageOf(() =>
      assertNativeBuildTarget('tap-app', 'withZephyr({ target })', 'metro')
    );
    expect(message).toBe(
      'withZephyr({ target }) must be "ios" or "android"; received "tap-app". Metro cannot publish tap-app artifacts.'
    );
  });

  it('rejects invalid values', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    for (const value of [undefined, 42, 'desktop', {}, circular]) {
      const run = () =>
        assertNativeBuildTarget(value, 'withZephyr({ target })', 'repack');
      expect(run).toThrow(TypeError);
      expect(messageOf(run)).toContain('must be "ios" or "android"');
    }
    expect(messageOf(() => assertNativeBuildTarget(undefined, 's', 'repack'))).toContain(
      'received undefined'
    );
  });
});
