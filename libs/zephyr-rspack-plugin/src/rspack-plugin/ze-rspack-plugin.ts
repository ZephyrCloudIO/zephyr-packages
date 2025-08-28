import type { ZephyrEngine } from 'zephyr-agent';

import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import {
  detectAndStoreBaseHref,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import type { Compiler } from '@rspack/core';

const pluginName = 'ZeRspackPlugin';

export interface ZephyrRspackInternalPluginOptions {
  zephyr_engine: ZephyrEngine;
  // rspack plugin name
  pluginName: string;
  // federated module config
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  // hacks
  wait_for_index_html?: boolean;
  // outputPath?: string;
}

export class ZeRspackPlugin {
  _options: ZephyrRspackInternalPluginOptions;

  constructor(options: Omit<ZephyrRspackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    detectAndStoreBaseHref(this._options.zephyr_engine, compiler);
    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);

    // Ensure our loader runs on JS/TS to rewrite env reads to virtual module
    const rules = (compiler as any).options?.module?.rules || [];
    rules.unshift({
      test: /\.[jt]sx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: require.resolve('./env-virtual-loader.js'),
          options: {
            specifier: `env:vars:${this._options.zephyr_engine.applicationProperties.name}`,
          },
        },
      ],
    });
    (compiler as any).options.module = (compiler as any).options.module || {};
    (compiler as any).options.module.rules = rules;

    // Mark the virtual specifier external so it remains an unresolved ESM import
    // that will be satisfied at serve-time via import maps.
    const existingExternals = (compiler as any).options?.externals;
    const PER_APP_SPECIFIER = `env:vars:${this._options.zephyr_engine.applicationProperties.name}`;
    const virtualExternal = {
      [PER_APP_SPECIFIER]: `module ${PER_APP_SPECIFIER}`,
    } as any;
    if (!existingExternals) {
      (compiler as any).options.externals = virtualExternal as any;
    } else if (Array.isArray(existingExternals)) {
      (compiler as any).options.externals = [
        ...existingExternals,
        virtualExternal,
      ] as any;
    } else if (typeof existingExternals === 'object') {
      (compiler as any).options.externals = {
        ...(existingExternals as any),
        ...virtualExternal,
      } as any;
    } // function externals not supported here; users can extend if needed

    // Note: dev-time HTML/env injection removed. All env injection is handled
    // at serve time by the worker via import maps.
  }
}
