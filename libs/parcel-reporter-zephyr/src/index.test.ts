// BDD description (unit tests are generated from this description):
//
//   Scenario: the plugin guards its public `target` option
//     Given an untyped caller passes an unsupported target such as "desktop"
//     Then the plugin throws before doing any work
//
//   Scenario: the plugin rejects the worker target
//     Given a caller passes target "worker"
//     Then the plugin throws a TypeError that points to ze-cli
//     And the "worker" literal is a compile-time error for typed callers
//
//   Scenario: existing targets keep working
//     Given a caller passes target "web" or "tap-app"
//     Then the target guard does not throw
//
// The remaining scenarios in this file cover the plugin lifecycle and are described by the test names.
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type * as ZephyrAgent from 'zephyr-agent';

const mocks = rs.hoisted(() => ({
  deferCreate: rs.fn(() => ({
    zephyr_engine_defer: Promise.resolve({}),
    zephyr_defer_create: rs.fn(),
  })),
  assertTapModuleFederationMetadata: rs.fn(),
  onBuildSuccess: rs.fn(),
  reporter: rs.fn(),
  isZephyrDisabled: rs.fn(() => false),
  logZephyrDisabled: rs.fn(),
}));

rs.mock('@parcel/plugin', () => ({
  Reporter: class {
    constructor(options: unknown) {
      mocks.reporter(options);
    }
  },
}));

rs.mock('zephyr-agent', () => ({
  assertZephyrBundlerBuildTarget: (rs.requireActual('zephyr-agent') as typeof ZephyrAgent)
    .assertZephyrBundlerBuildTarget,
  handleGlobalError: rs.fn(),
  isZephyrDisabled: mocks.isZephyrDisabled,
  logZephyrDisabled: mocks.logZephyrDisabled,
  ZephyrEngine: {
    defer_create: mocks.deferCreate,
  },
}));

rs.mock('./lib/on-build-start', () => ({
  onBuildStart: rs.fn(),
}));

rs.mock('./lib/on-build-success', () => ({
  assertTapModuleFederationMetadata: mocks.assertTapModuleFederationMetadata,
  onBuildSuccess: mocks.onBuildSuccess,
}));

import { createZephyrReporter } from './index';

describe('createZephyrReporter', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.isZephyrDisabled.mockReturnValue(false);
  });

  describe('with ZE_DISABLED', () => {
    async function reportAll(types: string[]) {
      createZephyrReporter();
      const reporterOptions = mocks.reporter.mock.calls[0]?.[0] as {
        report: (event: unknown) => Promise<void>;
      };
      for (const type of types) {
        await reporterOptions.report({
          event: { type },
          options: { inputFS: { cwd: () => '/project' } },
        });
      }
    }

    it('does no Zephyr step and says once that a successful build was not deployed', async () => {
      mocks.isZephyrDisabled.mockReturnValue(true);

      await reportAll(['buildStart', 'buildSuccess', 'buildStart', 'buildSuccess']);

      expect(mocks.onBuildSuccess).not.toHaveBeenCalled();
      expect(mocks.logZephyrDisabled).toHaveBeenCalledTimes(1);
    });

    it('says nothing when the build fails', async () => {
      mocks.isZephyrDisabled.mockReturnValue(true);

      await reportAll(['buildStart', 'buildFailure']);

      expect(mocks.logZephyrDisabled).not.toHaveBeenCalled();
      expect(mocks.onBuildSuccess).not.toHaveBeenCalled();
    });

    it('still validates the target first', () => {
      mocks.isZephyrDisabled.mockReturnValue(true);

      expect(() => createZephyrReporter({ target: 'desktop' as never })).toThrow();
    });

    it('keeps publishing when skip mode is off', async () => {
      await reportAll(['buildSuccess']);

      expect(mocks.onBuildSuccess).toHaveBeenCalledTimes(1);
      expect(mocks.logZephyrDisabled).not.toHaveBeenCalled();
    });
  });

  it('rejects an unsupported untyped target before creating a reporter engine', () => {
    expect(() => createZephyrReporter({ target: 'desktop' as never })).toThrow(
      'createZephyrReporter({ target }) must be one of'
    );
    expect(mocks.deferCreate).not.toHaveBeenCalled();
    expect(mocks.reporter).not.toHaveBeenCalled();
  });

  it('rejects the worker target and points to ze-cli', () => {
    // @ts-expect-error worker is publishable through ze-cli only
    const run = () => createZephyrReporter({ target: 'worker' });

    expect(run).toThrow(TypeError);
    expect(run).toThrow('createZephyrReporter({ target }) does not support "worker"');
    expect(run).toThrow('ze-cli');
  });

  it('keeps accepting the web and tap-app targets', () => {
    expect(() => createZephyrReporter({ target: 'web' })).not.toThrow();
    expect(() => createZephyrReporter({ target: 'tap-app' })).not.toThrow();
  });

  it('validates and forwards all TAP Module Federation containers to publication', async () => {
    const mfConfigs = [
      { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
      { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
    ];
    const federation = [
      { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
      { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs' },
    ];
    createZephyrReporter({ target: 'tap-app', mfConfigs, federation });

    expect(mocks.assertTapModuleFederationMetadata).toHaveBeenCalledWith(
      'tap-app',
      mfConfigs,
      federation
    );

    const reporterOptions = mocks.reporter.mock.calls[0]?.[0] as {
      report: (event: unknown) => Promise<void>;
    };
    await reporterOptions.report({
      event: { type: 'buildSuccess' },
      options: { inputFS: { cwd: () => '/project' } },
    });

    expect(mocks.onBuildSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ mfConfigs, federation })
    );
  });
});
