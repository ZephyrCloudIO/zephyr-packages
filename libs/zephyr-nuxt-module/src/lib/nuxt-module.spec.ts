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
}));

rs.mock('@nuxt/kit', () => ({
  defineNuxtModule: mocks.defineNuxtModule,
}));

rs.mock('zephyr-agent', () => ({
  assertZephyrBuildTarget: mocks.assertZephyrBuildTarget,
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
