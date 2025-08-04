import type { Configuration as RspackConfiguration } from '@rspack/core';
import { ZephyrEngine, ZephyrError, getTracer, initTelemetry, logFn } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { ZephyrRspackPluginOptions } from '../types';
import { ZeRspackPlugin } from './ze-rspack-plugin';

// Initialize telemetry for this plugin
void initTelemetry();

export type Configuration = RspackConfiguration;

export function withZephyr(
  zephyrPluginOptions?: ZephyrRspackPluginOptions
): (config: Configuration) => Promise<Configuration> {
  return (config) => _zephyr_configuration(config, zephyrPluginOptions);
}

async function _zephyr_configuration(
  config: Configuration,
  _zephyrOptions?: ZephyrRspackPluginOptions
): Promise<Configuration> {
  const tracer = getTracer('rspack-plugin-zephyr');
  const span = tracer.startSpan('rspack-plugin-configuration', {
    attributes: {
      'zephyr.plugin': 'rspack',
      'zephyr.operation': 'configuration',
      'zephyr.context': config.context || 'unknown',
    },
  });

  try {
    // Create ZephyrEngine span
    const engineSpan = tracer.startSpan('rspack-engine-creation', {
      attributes: {
        'zephyr.plugin': 'rspack',
        'zephyr.operation': 'engine-creation',
        'zephyr.builder': 'rspack',
      },
    });

    // create instance of ZephyrEngine to track the application
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'rspack',
      context: config.context,
    });

    engineSpan.setAttributes({
      'zephyr.application_uid': zephyr_engine.application_uid,
      'zephyr.project': zephyr_engine.applicationProperties?.project,
      'zephyr.app': zephyr_engine.applicationProperties?.name,
    });
    engineSpan.end();

    // Dependency resolution span
    const dependencySpan = tracer.startSpan('rspack-dependency-resolution', {
      attributes: {
        'zephyr.plugin': 'rspack',
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
    const configSpan = tracer.startSpan('rspack-config-mutation', {
      attributes: {
        'zephyr.plugin': 'rspack',
        'zephyr.operation': 'config-mutation',
      },
    });

    mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

    // inject the ZephyrRspackPlugin
    config.plugins?.push(
      new ZeRspackPlugin({
        zephyr_engine,
        mfConfig: makeCopyOfModuleFederationOptions(config),
        wait_for_index_html: _zephyrOptions?.wait_for_index_html,
      })
    );

    configSpan.setAttributes({
      'zephyr.plugins_count': config.plugins?.length || 0,
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
