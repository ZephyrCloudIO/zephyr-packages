import {
  xpack_zephyr_agent,
  type UploadAgentPluginOptions,
} from '../xpack-extract/ze-xpack-upload-agent';
import type { Source } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import type { XStats } from '../xpack.types';
import type { XPackParticipantDependencyPaths } from '../xpack-extract/xpack-build-coordinator';
import * as path from 'node:path';

interface DeployPluginOptions extends UploadAgentPluginOptions {
  pluginName: string;
}

interface DeployCompiler {
  context?: string;
  webpack: { Compilation: { PROCESS_ASSETS_STAGE_REPORT: number } };
  hooks: {
    thisCompilation: {
      tap: (pluginName: string, cb: (compilation: DeployCompilation) => void) => void;
    };
    afterEmit: {
      tapPromise: (
        pluginName: string,
        cb: (compilation: DeployCompilation) => Promise<void>
      ) => void;
    };
    invalid?: {
      tap: (
        pluginName: string,
        cb: (filename?: string | null, changeTime?: number) => void
      ) => void;
    };
    failed?: {
      tap: (pluginName: string, cb: (error: Error) => void) => void;
    };
  };
}

interface DeployCompilation {
  getStats: () => XStats;
  errors?: readonly unknown[];
  fileDependencies?: Iterable<string>;
  contextDependencies?: Iterable<string>;
  missingDependencies?: Iterable<string>;
  buildDependencies?: Iterable<string>;
  hooks: {
    processAssets: {
      tapPromise: (
        options: { name: string; stage: number },
        cb: (assets: Record<string, Source>) => Promise<void>
      ) => void;
    };
  };
}

function dependencyList(dependencies: Iterable<string> | undefined): string[] {
  return dependencies
    ? [...dependencies].filter((value) => typeof value === 'string')
    : [];
}

function collectDependencyPaths(
  compilation: DeployCompilation
): XPackParticipantDependencyPaths {
  return {
    fileDependencies: dependencyList(compilation.fileDependencies),
    contextDependencies: dependencyList(compilation.contextDependencies),
    missingDependencies: dependencyList(compilation.missingDependencies),
    buildDependencies: dependencyList(compilation.buildDependencies),
  };
}

export function setupZeDeploy<
  T extends DeployPluginOptions,
  XCompiler extends DeployCompiler,
>(pluginOptions: T, compiler: XCompiler): void {
  const { pluginName } = pluginOptions;
  let generation = 0;
  const finalizedUploads = new WeakMap<
    DeployCompilation,
    { assets: Record<string, Source>; generation: number }
  >();

  const getSuccessfulStats = (compilation: DeployCompilation): XStats => {
    const stats = compilation.getStats();
    if (!stats.hasErrors?.() && (compilation.errors?.length ?? 0) === 0) {
      return stats;
    }

    const error = new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `Zephyr will not upload ${pluginOptions.participant ?? 'xpack'} output because the compilation contains errors.`,
    });
    if (pluginOptions.coordinator && pluginOptions.participant) {
      pluginOptions.coordinator.failParticipant(pluginOptions.participant, error);
    } else if (pluginOptions.zephyr_engine.hasActiveBuild) {
      pluginOptions.zephyr_engine.build_failed();
    }
    throw error;
  };

  const upload = async (
    compilation: DeployCompilation,
    assets: Record<string, Source>,
    compilationGeneration: number,
    assetsAreFinal: boolean
  ): Promise<void> => {
    const stats = getSuccessfulStats(compilation);
    const stats_json = stats.toJson();

    if (!pluginOptions.coordinator) {
      try {
        await pluginOptions.zephyr_engine.start_new_build();
      } catch (error: unknown) {
        if (pluginOptions.zephyr_engine.hasActiveBuild !== false) {
          pluginOptions.zephyr_engine.build_failed();
        }
        throw error;
      }
    }

    await xpack_zephyr_agent({
      stats,
      stats_json,
      assets,
      pluginOptions: {
        ...pluginOptions,
        generation: compilationGeneration,
        dependencyPaths: collectDependencyPaths(compilation),
        // afterEmit observes the finalized compilation asset object. Do not wait on
        // the legacy out-of-band index event, which can deadlock or outlive the build.
        wait_for_index_html: assetsAreFinal ? false : pluginOptions.wait_for_index_html,
      },
    });

    // empty line to separate logs from other plugins
    console.log();
  };

  if (pluginOptions.wait_for_index_html) {
    compiler.hooks.afterEmit.tapPromise(pluginName, async (compilation) => {
      const pending = finalizedUploads.get(compilation);
      if (!pending) return;
      finalizedUploads.delete(compilation);
      await upload(compilation, pending.assets, pending.generation, true);
    });
  }

  if (pluginOptions.coordinator && pluginOptions.participant) {
    const participant = pluginOptions.participant;
    // MultiCompiler invalidates affected children before it runs them. Register the
    // logical batch here so a fast client cannot publish with stale server output while
    // a parallelism=1 server compiler is still waiting to start.
    compiler.hooks.invalid?.tap(pluginName, (filename) => {
      const invalidatedPath = filename
        ? path.resolve(compiler.context ?? process.cwd(), filename)
        : filename;
      pluginOptions.coordinator?.invalidateParticipant(participant, invalidatedPath);
    });
  }

  // A failed compiler never reaches processAssets/afterEmit. Release either its shared
  // session barrier or the directly-owned engine generation immediately.
  compiler.hooks.failed?.tap(pluginName, (error) => {
    if (pluginOptions.coordinator && pluginOptions.participant) {
      pluginOptions.coordinator.failParticipant(pluginOptions.participant, error);
    } else {
      if (pluginOptions.zephyr_engine.hasActiveBuild !== false) {
        pluginOptions.zephyr_engine.build_failed();
      }
    }
  });

  compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
    const compilationGeneration = generation++;
    if (pluginOptions.coordinator) {
      if (!pluginOptions.participant) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message: 'A coordinated xpack build requires a participant name',
        });
      }
      pluginOptions.coordinator.beginParticipant(
        pluginOptions.participant,
        compilationGeneration
      );
    }
    compilation.hooks.processAssets.tapPromise(
      {
        name: pluginName,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      },
      async (assets) => {
        if (pluginOptions.wait_for_index_html) {
          // Production Webpack/Rspack can skip emit and therefore afterEmit when a
          // compilation has errors. Fail the lifecycle here instead of leaving the
          // deferred upload and coordinated participant barrier active forever.
          getSuccessfulStats(compilation);
          finalizedUploads.set(compilation, {
            assets,
            generation: compilationGeneration,
          });
          return;
        }
        await upload(compilation, assets, compilationGeneration, false);
      }
    );
  });
}
