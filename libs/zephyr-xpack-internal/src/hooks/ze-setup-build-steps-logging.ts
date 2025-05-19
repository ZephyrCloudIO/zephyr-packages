import type { ZephyrEngine } from 'zephyr-agent';
import { ze_log, ZephyrError } from 'zephyr-agent';

interface BuildSteps {
  pluginName: string;
  zephyr_engine: ZephyrEngine | Promise<ZephyrEngine>;
}

interface BuildStepsCompiler {
  hooks: {
    beforeCompile: {
      tapAsync: (
        pluginName: string,
        cb: (params: unknown, cb: () => void) => Promise<void>
      ) => void;
    };
    failed: {
      tap: (pluginName: string, cb: (err: Error) => void) => void;
    };
  };
}

export function logBuildSteps<T extends BuildSteps, Compiler extends BuildStepsCompiler>(
  pluginOptions: T,
  compiler: Compiler
): {
  buildStartedAt: number;
} {
  const { pluginName } = pluginOptions;

  let buildStartedAt = Date.now();

  compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, cb) => {
    buildStartedAt = Date.now();
    ze_log('build started at', buildStartedAt);
    cb();
  });

  compiler.hooks.failed.tap(pluginName, (err) => {
    ze_log(`build failed in ${Date.now() - buildStartedAt}ms`);

    const errorLog = (zephyrEngine: ZephyrEngine) =>
      zephyrEngine.logger.then((logger) =>
        logger({
          level: 'error',
          action: 'build:failed',
          message: ZephyrError.format(err),
        })
      );

    if (pluginOptions.zephyr_engine instanceof Promise) {
      return void pluginOptions.zephyr_engine.then(errorLog);
    }

    errorLog(pluginOptions.zephyr_engine);
  });

  return { buildStartedAt };
}
