import { context, trace } from '@opentelemetry/api';
import { cwd } from 'node:process';
import type { InputOptions, NormalizedOutputOptions, OutputBundle } from 'rollup';
import {
  getTracer,
  logFn,
  zeBuildDashData,
  ZephyrEngine,
  ZephyrError,
} from 'zephyr-agent';
import { getAssetsMap } from './transform/get-assets-map';

// Initialize telemetry for this plugin
import { initTelemetry } from 'zephyr-agent';
void initTelemetry();

const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

export function withZephyr() {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const tracer = getTracer('rollup-plugin-zephyr');

  return {
    name: 'with-zephyr',
    buildStart: async (options: InputOptions) => {
      const span = tracer.startSpan('rollup-plugin-build-start', {
        attributes: {
          'zephyr.plugin': 'rollup',
          'zephyr.operation': 'build-start',
          'zephyr.input_folder': getInputFolder(options),
        },
      });

      try {
        const path_to_execution_dir = getInputFolder(options);
        span.setAttributes({
          'zephyr.execution_dir': path_to_execution_dir,
        });

        zephyr_defer_create({
          builder: 'rollup',
          context: path_to_execution_dir,
        });

        span.setStatus({ code: 1 }); // OK
        span.end();
      } catch (error) {
        span.setStatus({ code: 2, message: String(error) }); // ERROR
        span.recordException(error as Error);
        span.end();
        throw error;
      }
    },
    writeBundle: async (_options: NormalizedOutputOptions, bundle: OutputBundle) => {
      const span = tracer.startSpan('rollup-plugin-write-bundle', {
        attributes: {
          'zephyr.plugin': 'rollup',
          'zephyr.operation': 'write-bundle',
          'zephyr.bundle_size': Object.keys(bundle).length,
        },
      });

      try {
        const zephyr_engine = await zephyr_engine_defer;

        // Start a new build
        const buildContext = trace.setSpan(context.active(), span);
        const buildSpan = tracer.startSpan(
          'rollup-build-process',
          {
            attributes: {
              'zephyr.plugin': 'rollup',
              'zephyr.operation': 'build-process',
              'zephyr.builder': 'rollup',
            },
          },
          buildContext
        );

        await zephyr_engine.start_new_build();
        buildSpan.end();

        // Asset processing
        const assetContext = trace.setSpan(context.active(), span);
        const assetSpan = tracer.startSpan(
          'rollup-asset-processing',
          {
            attributes: {
              'zephyr.plugin': 'rollup',
              'zephyr.operation': 'asset-processing',
              'zephyr.bundle_files': Object.keys(bundle).length,
            },
          },
          assetContext
        );

        const assetsMap = getAssetsMap(bundle);
        assetSpan.setAttributes({
          'zephyr.assets_count': Object.keys(assetsMap).length,
        });
        assetSpan.end();

        // Upload assets
        const uploadContext = trace.setSpan(context.active(), span);
        const uploadSpan = tracer.startSpan(
          'rollup-asset-upload',
          {
            attributes: {
              'zephyr.plugin': 'rollup',
              'zephyr.operation': 'asset-upload',
              'zephyr.assets_to_upload': Object.keys(assetsMap).length,
            },
          },
          uploadContext
        );

        await zephyr_engine.upload_assets({
          assetsMap,
          buildStats: await zeBuildDashData(zephyr_engine),
        });
        uploadSpan.end();

        // Build completion
        const completionContext = trace.setSpan(context.active(), span);
        const completionSpan = tracer.startSpan(
          'rollup-build-completion',
          {
            attributes: {
              'zephyr.plugin': 'rollup',
              'zephyr.operation': 'build-completion',
            },
          },
          completionContext
        );

        await zephyr_engine.build_finished();
        completionSpan.end();

        span.setStatus({ code: 1 }); // OK
        span.end();
      } catch (error) {
        span.setStatus({ code: 2, message: String(error) }); // ERROR
        span.recordException(error as Error);
        span.end();
        logFn('error', ZephyrError.format(error));
      }
    },
  };
}
