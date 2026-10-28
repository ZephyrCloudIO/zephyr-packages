import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({ logZephyrDisabled: rs.fn() }));

rs.mock('zephyr-agent', () => ({ logZephyrDisabled: mocks.logZephyrDisabled }));

import { disableZephyrForXpack } from './ze-disabled-plugin';

type Done = (stats: { hasErrors(): boolean }) => void;

/** Applies each config's plugin to a fake compiler and returns its `done` callback. */
function compilers(configs: Array<{ plugins?: unknown[] }>): Done[] {
  return configs.map((config) => {
    let done: Done | undefined;
    const plugin = config.plugins?.[0] as { apply(compiler: unknown): void };
    plugin.apply({
      hooks: { done: { tap: (_name: string, callback: Done) => (done = callback) } },
    });
    return done as Done;
  });
}

const ok = { hasErrors: () => false };
const failed = { hasErrors: () => true };

describe('disableZephyrForXpack', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('adds one plugin to a single config and returns the same object', () => {
    const config: { plugins?: unknown[] } = {};

    expect(disableZephyrForXpack(config)).toBe(config);
    expect(config.plugins).toHaveLength(1);
  });

  it('keeps the plugins the config already has', () => {
    const existing = {};
    const config = { plugins: [existing] };

    disableZephyrForXpack(config);

    expect(config.plugins[0]).toBe(existing);
    expect(config.plugins).toHaveLength(2);
  });

  it('says it once, when the build finishes', () => {
    const [done] = compilers([disableZephyrForXpack({})]);

    done(ok);
    done(ok);

    expect(mocks.logZephyrDisabled).toHaveBeenCalledTimes(1);
  });

  it('does not say the bundle is built when the compile has errors', () => {
    const config = disableZephyrForXpack({});
    const [done] = compilers([config]);

    done(failed);
    expect(mocks.logZephyrDisabled).not.toHaveBeenCalled();

    // A watch rebuild that succeeds does build the bundle.
    done(ok);
    done(ok);
    expect(mocks.logZephyrDisabled).toHaveBeenCalledTimes(1);
  });

  it('waits for every compiler of a config array', () => {
    const configs = disableZephyrForXpack([{}, {}, {}]);
    const [first, second, third] = compilers(configs);

    first(ok);
    first(ok);
    second(ok);
    expect(mocks.logZephyrDisabled).not.toHaveBeenCalled();

    third(failed);
    expect(mocks.logZephyrDisabled).not.toHaveBeenCalled();

    third(ok);
    expect(mocks.logZephyrDisabled).toHaveBeenCalledTimes(1);
  });
});
