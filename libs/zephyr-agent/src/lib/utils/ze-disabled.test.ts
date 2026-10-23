import { afterEach, describe, expect, it, rs } from '@rstest/core';
import {
  createZephyrDisabledBuildHooks,
  isZephyrDisabled,
  logZephyrDisabled,
  ZE_DISABLED_MESSAGE,
} from './ze-disabled';

const original = process.env['ZE_DISABLED'];

afterEach(() => {
  if (original === undefined) delete process.env['ZE_DISABLED'];
  else process.env['ZE_DISABLED'] = original;
  rs.restoreAllMocks();
});

describe('ZE_DISABLED', () => {
  it('is off unless it is exactly "true"', () => {
    delete process.env['ZE_DISABLED'];
    expect(isZephyrDisabled()).toBe(false);

    for (const value of ['', 'false', '1', 'TRUE', 'yes', ' true']) {
      process.env['ZE_DISABLED'] = value;
      expect(isZephyrDisabled()).toBe(false);
    }

    process.env['ZE_DISABLED'] = 'true';
    expect(isZephyrDisabled()).toBe(true);
  });

  it('prints the agreed line as a warning', () => {
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined);

    logZephyrDisabled();

    expect(ZE_DISABLED_MESSAGE).toBe(
      'The bundle is built. The bundle is not deployed. Zephyr is disabled (ZE_DISABLED).'
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(ZE_DISABLED_MESSAGE);
  });
});

describe('createZephyrDisabledBuildHooks', () => {
  function run(
    steps: (hooks: ReturnType<typeof createZephyrDisabledBuildHooks>) => void
  ) {
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined);
    steps(createZephyrDisabledBuildHooks());
    return warn.mock.calls.length;
  }

  it('says once that the bundle was not deployed after a clean build', () => {
    expect(
      run((hooks) => {
        hooks.buildStart();
        hooks.buildEnd();
        hooks.closeBundle();
        hooks.closeBundle();
      })
    ).toBe(1);
  });

  it('says nothing when the build or the render fails', () => {
    expect(
      run((hooks) => {
        hooks.buildStart();
        hooks.buildEnd(new Error('boom'));
        hooks.closeBundle();
      })
    ).toBe(0);
    rs.restoreAllMocks();
    expect(
      run((hooks) => {
        hooks.buildStart();
        hooks.buildEnd();
        hooks.renderError();
        hooks.closeBundle();
      })
    ).toBe(0);
  });
});
