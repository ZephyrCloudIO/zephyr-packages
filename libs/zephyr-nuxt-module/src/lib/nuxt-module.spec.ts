import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  assertZephyrBuildTarget: rs.fn((value: unknown, optionName = 'target') => {
    if (!['web', 'ios', 'android', 'tap-app'].includes(value as string)) {
      throw new TypeError(`${optionName} must be one of web, ios, android, tap-app`);
    }
  }),
  defineNuxtModule: rs.fn((definition: unknown) => definition),
  deferCreate: rs.fn(),
  zephyrDeferCreate: rs.fn(),
  shouldSkipZephyrUpload: rs.fn(),
  createUploadRunner: rs.fn(),
  isZephyrDisabled: rs.fn(() => false),
  logZephyrDisabled: rs.fn(),
}));

rs.mock('@nuxt/kit', () => ({
  defineNuxtModule: mocks.defineNuxtModule,
}));

rs.mock('zephyr-agent', () => ({
  assertZephyrBuildTarget: mocks.assertZephyrBuildTarget,
  isZephyrDisabled: mocks.isZephyrDisabled,
  logZephyrDisabled: mocks.logZephyrDisabled,
  ZephyrEngine: {
    defer_create: mocks.deferCreate,
  },
}));

rs.mock('./runtime-guards', () => ({
  shouldSkipZephyrUpload: mocks.shouldSkipZephyrUpload,
}));

rs.mock('./ssr-upload', () => ({
  createUploadRunner: mocks.createUploadRunner,
}));

import zephyrNuxtModule from './nuxt-module';

interface NuxtModuleDefinition {
  setup: (options: { target?: string }, nuxt: unknown) => void;
}

describe('zephyr-nuxt-module', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.deferCreate.mockReturnValue({
      zephyr_engine_defer: Promise.resolve({}),
      zephyr_defer_create: mocks.zephyrDeferCreate,
    });
    mocks.shouldSkipZephyrUpload.mockReturnValue(false);
    mocks.createUploadRunner.mockReturnValue(rs.fn());
    mocks.isZephyrDisabled.mockReturnValue(false);
  });

  describe('with ZE_DISABLED', () => {
    function setup(options: { target?: string } = {}, dev = false) {
      const hooks = new Map<string, () => void | Promise<void>>();
      const nuxt = {
        options: { rootDir: '/workspace/app', dev },
        hook: (name: string, fn: () => void | Promise<void>) => hooks.set(name, fn),
      };
      (zephyrNuxtModule as unknown as NuxtModuleDefinition).setup(options, nuxt);
      return hooks;
    }

    beforeEach(() => {
      mocks.isZephyrDisabled.mockReturnValue(true);
    });

    it('creates no engine or upload and says the bundle was not deployed on close', async () => {
      const hooks = setup();

      expect(mocks.deferCreate).not.toHaveBeenCalled();
      expect(mocks.createUploadRunner).not.toHaveBeenCalled();
      await hooks.get('close')?.();
      expect(mocks.logZephyrDisabled).toHaveBeenCalledTimes(1);
    });

    it('says nothing when the build failed', async () => {
      const hooks = setup();

      await hooks.get('build:error')?.();
      await hooks.get('close')?.();

      expect(mocks.logZephyrDisabled).not.toHaveBeenCalled();
    });

    it('registers nothing for the dev server or prepare', () => {
      mocks.shouldSkipZephyrUpload.mockReturnValue(true);

      expect(setup().size).toBe(0);
      mocks.shouldSkipZephyrUpload.mockReturnValue(false);
      expect(setup({}, true).size).toBe(0);
    });

    it('still validates the target first', () => {
      expect(() => setup({ target: 'desktop' })).toThrow();
    });
  });

  it('forwards tap-app through the public Nuxt module option', () => {
    const hook = rs.fn();
    const nuxt = {
      options: {
        rootDir: '/workspace/tap-package',
        dev: false,
      },
      hook,
    };
    const definition = zephyrNuxtModule as unknown as NuxtModuleDefinition;

    definition.setup({ target: 'tap-app' }, nuxt);

    const uploadContext = mocks.createUploadRunner.mock.calls[0]?.[0] as {
      initEngine: () => void;
    };
    uploadContext.initEngine();

    expect(mocks.zephyrDeferCreate).toHaveBeenCalledWith({
      builder: 'nuxt',
      context: '/workspace/tap-package',
      target: 'tap-app',
    });
    expect(hook).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('rejects an unsupported untyped target before registering Nuxt hooks', () => {
    const hook = rs.fn();
    const nuxt = {
      options: {
        rootDir: '/workspace/tap-package',
        dev: false,
      },
      hook,
    };
    const definition = zephyrNuxtModule as unknown as NuxtModuleDefinition;

    expect(() => definition.setup({ target: 'desktop' }, nuxt)).toThrow(
      'zephyr({ target }) must be one of'
    );
    expect(mocks.deferCreate).not.toHaveBeenCalled();
    expect(mocks.createUploadRunner).not.toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
  });
});
