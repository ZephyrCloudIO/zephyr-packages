import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  assertZephyrBuildTarget: rs.fn((value: unknown, optionName = 'target') => {
    if (!['web', 'ios', 'android', 'tap-app'].includes(value as string)) {
      throw new TypeError(`${optionName} must be one of web, ios, android, tap-app`);
    }
  }),
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
  assertZephyrBuildTarget: mocks.assertZephyrBuildTarget,
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
