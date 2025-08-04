import type { Configuration } from 'webpack';
import {
  ZephyrEngine,
  ZephyrError,
  getTracer,
  initTelemetry,
  logFn,
  ze_log,
} from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { ZephyrWebpackPluginOptions } from '../types';
import type { WebpackConfiguration } from '../types/missing-webpack-types';
import { ZeWebpackPlugin } from './ze-webpack-plugin';

// Initialize telemetry for this plugin
void initTelemetry();

export function withZephyr(zephyrPluginOptions?: ZephyrWebpackPluginOptions) {
  return (config: Configuration) => _zephyr_configuration(config, zephyrPluginOptions);
}

async function _zephyr_configuration(
  config: WebpackConfiguration,
  _zephyrOptions?: ZephyrWebpackPluginOptions
): Promise<Configuration> {
  const tracer = getTracer('webpack-plugin-zephyr');
  const span = tracer.startSpan('webpack-plugin-configuration', {
    attributes: {
      'zephyr.plugin': 'webpack',
      'zephyr.operation': 'configuration',
      'zephyr.context': config.context || 'unknown',
    },
  });

  try {
    // Create ZephyrEngine span
    const engineSpan = tracer.startSpan('webpack-engine-creation', {
      attributes: {
        'zephyr.plugin': 'webpack',
        'zephyr.operation': 'engine-creation',
        'zephyr.builder': 'webpack',
      },
    });

    // create instance of ZephyrEngine to track the application
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'webpack',
      context: config.context,
    });

    engineSpan.setAttributes({
      'zephyr.application_uid': zephyr_engine.application_uid,
      'zephyr.project': zephyr_engine.applicationProperties?.project,
      'zephyr.app': zephyr_engine.applicationProperties?.name,
    });
    engineSpan.end();

    // Dependency resolution span
    const dependencySpan = tracer.startSpan('webpack-dependency-resolution', {
      attributes: {
        'zephyr.plugin': 'webpack',
        'zephyr.operation': 'dependency-resolution',
      },
    });

    // Resolve dependencies and update the config
    const dependencyPairs = extractFederatedDependencyPairs(config);
    dependencySpan.setAttributes({
      'zephyr.dependency_pairs_count': dependencyPairs?.length || 0,
    });

    const resolved_dependency_pairs =
      await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

    dependencySpan.setAttributes({
      'zephyr.resolved_dependencies_count': resolved_dependency_pairs?.length || 0,
    });
    dependencySpan.end();

    // Config mutation span
    const configSpan = tracer.startSpan('webpack-config-mutation', {
      attributes: {
        'zephyr.plugin': 'webpack',
        'zephyr.operation': 'config-mutation',
      },
    });

    mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

    const mfConfig = makeCopyOfModuleFederationOptions(config);

    ze_log.mf(`with-zephyr.mfConfig: ${JSON.stringify(mfConfig, null, 2)}`);

    // inject the ZephyrWebpackPlugin
    config.plugins?.push(
      new ZeWebpackPlugin({
        zephyr_engine,
        mfConfig: mfConfig,
        wait_for_index_html: _zephyrOptions?.wait_for_index_html,
      })
    );

    configSpan.setAttributes({
      'zephyr.plugins_count': config.plugins?.length || 0,
      'zephyr.mf_config_present': !!mfConfig,
    });
    configSpan.end();

    span.setStatus({ code: 1 }); // OK
    span.end();
  } catch (error) {
    span.setStatus({ code: 2, message: String(error) }); // ERROR
    span.recordException(error as Error);
    span.end();
    logFn('error', ZephyrError.format(error));
  }

  return config;
}
