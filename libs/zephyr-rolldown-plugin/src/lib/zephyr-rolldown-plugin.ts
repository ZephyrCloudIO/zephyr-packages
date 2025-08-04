import { cwd } from 'node:process';
import type { InputOptions, NormalizedOutputOptions, OutputBundle } from 'rolldown';
import {
  getTracer,
  initTelemetry,
  logFn,
  zeBuildDashData,
  ZephyrEngine,
  ZephyrError,
} from 'zephyr-agent';
import { getAssetsMap } from './internal/get-assets-map';

// Initialize telemetry for this plugin
void initTelemetry();

const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

export function withZephyr() {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const tracer = getTracer('rolldown-plugin-zephyr');

  return {
    name: 'with-zephyr',
    buildStart: async (options: InputOptions) => {
      const span = tracer.startSpan('rolldown-plugin-build-start', {
        attributes: {
          'zephyr.plugin': 'rolldown',
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
          builder: 'rollup', //TODO(Nestor): API is the same, but we should make it explicit.
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
      const span = tracer.startSpan('rolldown-plugin-write-bundle', {
        attributes: {
          'zephyr.plugin': 'rolldown',
          'zephyr.operation': 'write-bundle',
          'zephyr.bundle_size': Object.keys(bundle).length,
        },
      });

      try {
        const zephyr_engine = await zephyr_engine_defer;

        // basehref support
        zephyr_engine.buildProperties.baseHref = _options.dir;

        // Start a new build
        const buildSpan = tracer.startSpan('rolldown-build-process', {
          attributes: {
            'zephyr.plugin': 'rolldown',
            'zephyr.operation': 'build-process',
            'zephyr.builder': 'rolldown',
          },
        });

        await zephyr_engine.start_new_build();
        buildSpan.end();

        // Asset processing
        const assetSpan = tracer.startSpan('rolldown-asset-processing', {
          attributes: {
            'zephyr.plugin': 'rolldown',
            'zephyr.operation': 'asset-processing',
            'zephyr.bundle_files': Object.keys(bundle).length,
          },
        });

        const assetsMap = getAssetsMap(bundle);
        assetSpan.setAttributes({
          'zephyr.assets_count': Object.keys(assetsMap).length,
        });
        assetSpan.end();

        // Upload assets
        const uploadSpan = tracer.startSpan('rolldown-asset-upload', {
          attributes: {
            'zephyr.plugin': 'rolldown',
            'zephyr.operation': 'asset-upload',
            'zephyr.assets_to_upload': Object.keys(assetsMap).length,
          },
        });

        await zephyr_engine.upload_assets({
          assetsMap,
          buildStats: await zeBuildDashData(zephyr_engine),
        });
        uploadSpan.end();

        // Build completion
        const completionSpan = tracer.startSpan('rolldown-build-completion', {
          attributes: {
            'zephyr.plugin': 'rolldown',
            'zephyr.operation': 'build-completion',
          },
        });

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
