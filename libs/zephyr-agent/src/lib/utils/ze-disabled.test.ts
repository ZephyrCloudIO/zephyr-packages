import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { isZephyrDisabled, logZephyrDisabled, ZE_DISABLED_MESSAGE } from './ze-disabled';

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
