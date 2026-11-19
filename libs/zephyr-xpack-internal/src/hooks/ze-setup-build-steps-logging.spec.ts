import { describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import { ze_log } from 'zephyr-agent';
import { logBuildSteps } from './ze-setup-build-steps-logging';

rs.mock('zephyr-agent', () => ({
  ze_log: {
    init: rs.fn(),
    misc: rs.fn(),
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
  it('logs the failure timing without reporting build:failed itself', async () => {
    const compiler = testCompiler();
    const remoteLogger = rs.fn();
    const build_failed = rs.fn();

    logBuildSteps(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {
          logger: Promise.resolve(remoteLogger),
          build_failed,
        } as never,
      },
      compiler
    );

    const failedHook = (compiler.hooks.failed.tap as Mock).mock.calls[0][1];
    failedHook(new Error('compiler failed'));
    await new Promise<void>((resolve) => setImmediate(resolve));

    // setupZeDeploy's `failed` hook owns the single `build_failed(error)` report.
    expect(remoteLogger).not.toHaveBeenCalled();
    expect(build_failed).not.toHaveBeenCalled();
    expect(ze_log.misc).toHaveBeenCalledWith(
      expect.stringMatching(/^build failed in \d+ms$/)
    );
  });
});
