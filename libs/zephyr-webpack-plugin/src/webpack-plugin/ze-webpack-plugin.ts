import type { Compiler } from 'webpack';
import type { ZephyrEngine } from 'zephyr-agent';
import { getTracer } from 'zephyr-agent';

import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import {
  detectAndStoreBaseHref,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';

const pluginName = 'ZeWebpackPlugin';

export interface ZephyrWebpackInternalPluginOptions {
  zephyr_engine: ZephyrEngine;
  // webpack plugin name
  pluginName: string;
  // federated module config
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  // hacks
  wait_for_index_html?: boolean;
  // outputPath?: string;
}

export class ZeWebpackPlugin {
  _options: ZephyrWebpackInternalPluginOptions;

  constructor(options: Omit<ZephyrWebpackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    const tracer = getTracer('webpack-plugin-zephyr');
    const span = tracer.startSpan('webpack-plugin-apply', {
      attributes: {
        'zephyr.plugin': 'webpack',
        'zephyr.operation': 'plugin-apply',
        'zephyr.output_path': compiler.outputPath,
      },
    });

    try {
      // Set output path
      this._options.zephyr_engine.buildProperties.output = compiler.outputPath;

      // Detect base href
      const baseHrefSpan = tracer.startSpan('webpack-base-href-detection', {
        attributes: {
          'zephyr.plugin': 'webpack',
          'zephyr.operation': 'base-href-detection',
        },
      });
      detectAndStoreBaseHref(this._options.zephyr_engine, compiler);
      baseHrefSpan.end();

      // Log build steps
      const buildStepsSpan = tracer.startSpan('webpack-build-steps-logging', {
        attributes: {
          'zephyr.plugin': 'webpack',
          'zephyr.operation': 'build-steps-logging',
        },
      });
      logBuildSteps(this._options, compiler);
      buildStepsSpan.end();

      // Setup deployment
      const deploySpan = tracer.startSpan('webpack-deployment-setup', {
        attributes: {
          'zephyr.plugin': 'webpack',
          'zephyr.operation': 'deployment-setup',
          'zephyr.wait_for_index_html': this._options.wait_for_index_html || false,
        },
      });
      setupZeDeploy(this._options, compiler);
      deploySpan.end();

      span.setStatus({ code: 1 }); // OK
      span.end();
    } catch (error) {
      span.setStatus({ code: 2, message: String(error) }); // ERROR
      span.recordException(error as Error);
      span.end();
      throw error;
    }
  }
}
