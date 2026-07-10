import { describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import { ze_log } from 'zephyr-agent';
import { logBuildSteps } from './ze-setup-build-steps-logging';

rs.mock('zephyr-agent', () => ({
  ze_log: {
    init: rs.fn(),
    misc: rs.fn(),
  },
  ZephyrError: {
    format: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  },
}));

interface TestCompiler {
  hooks: {
    beforeCompile: { tapAsync: Mock };
    failed: { tap: Mock };
  };
}

function testCompiler(): TestCompiler {
  return {
    hooks: {
      beforeCompile: { tapAsync: rs.fn() },
      failed: { tap: rs.fn() },
    },
  };
}

describe('logBuildSteps', () => {
  it('handles logger initialization rejection in the failed hook', async () => {
    const loggerFailure = new Error('logger initialization failed');
    const compiler = testCompiler();

    logBuildSteps(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {
          logger: Promise.reject(loggerFailure),
        } as never,
      },
      compiler
    );

    const failedHook = (compiler.hooks.failed.tap as Mock).mock.calls[0][1];
    failedHook(new Error('compiler failed'));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(ze_log.misc).toHaveBeenCalledWith(
      'Unable to report the failed build through the Zephyr logger:',
      'logger initialization failed'
    );
  });

  it('handles a failed logger write without creating an unhandled promise', async () => {
    const compiler = testCompiler();
    const writeFailure = new Error('logger write failed');
    logBuildSteps(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {
          logger: Promise.resolve(() => {
            throw writeFailure;
          }),
        } as never,
      },
      compiler
    );

    const failedHook = (compiler.hooks.failed.tap as Mock).mock.calls[0][1];
    failedHook(new Error('compiler failed'));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(ze_log.misc).toHaveBeenCalledWith(
      'Unable to report the failed build through the Zephyr logger:',
      'logger write failed'
    );
  });
});
