import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  deferCreate: rs.fn(),
  create: rs.fn(),
  logZephyrDisabled: rs.fn(),
}));

rs.mock('zephyr-agent', () => {
  const actual = rs.requireActual('zephyr-agent') as Record<string, unknown>;
  return {
    ...actual,
    ZephyrEngine: { defer_create: mocks.deferCreate, create: mocks.create },
    logZephyrDisabled: mocks.logZephyrDisabled,
  };
});

import { withZephyr } from '../astro-integration-zephyr';

describe('astro withZephyr with ZE_DISABLED', () => {
  const saved = process.env['ZE_DISABLED'];

  beforeEach(() => {
    rs.clearAllMocks();
    mocks.deferCreate.mockReturnValue({
      zephyr_engine_defer: new Promise(() => undefined),
      zephyr_defer_create: rs.fn(),
    });
  });

  afterEach(() => {
    if (saved === undefined) delete process.env['ZE_DISABLED'];
    else process.env['ZE_DISABLED'] = saved;
  });

  it('creates no engine, registers no Vite plugin and says the bundle was not deployed', async () => {
    process.env['ZE_DISABLED'] = 'true';

    const integration = withZephyr();

    expect(mocks.deferCreate).not.toHaveBeenCalled();
    expect(Object.keys(integration.hooks)).toEqual(['astro:build:done']);
    await (integration.hooks['astro:build:done'] as () => unknown)();
    expect(mocks.logZephyrDisabled).toHaveBeenCalledTimes(1);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('still validates the target first', () => {
    process.env['ZE_DISABLED'] = 'true';

    expect(() => withZephyr({ target: 'desktop' as never })).toThrow();
  });

  it('keeps the normal hooks when it is not exactly "true"', () => {
    process.env['ZE_DISABLED'] = 'false';

    const integration = withZephyr();

    expect(mocks.deferCreate).toHaveBeenCalledTimes(1);
    expect(Object.keys(integration.hooks)).toEqual(
      expect.arrayContaining(['astro:config:setup', 'astro:config:done'])
    );
    expect(mocks.logZephyrDisabled).not.toHaveBeenCalled();
  });
});
