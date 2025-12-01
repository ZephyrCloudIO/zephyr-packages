import type { Compiler } from '@rspack/core';
import type { ZephyrEngine, ZephyrBuildHooks } from 'zephyr-agent';
import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import { logBuildSteps, setupZeDeploy } from 'zephyr-xpack-internal';
import type { Platform } from 'zephyr-agent';
const pluginName = 'ZephyrRepackPlugin';

export interface ZephyrRepackPluginOptions {
  zephyr_engine: ZephyrEngine;
  pluginName: string;
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  target: Platform | undefined;
  /** Enable OTA updates */
  enableOTA?: boolean;
  /** Application UID for OTA */
  applicationUid?: string;
  /** OTA configuration */
  otaConfig?: {
    checkInterval?: number;
    debug?: boolean;
    otaEndpoint?: string;
  };
  hooks?: ZephyrBuildHooks;
}

export class ZeRepackPlugin {
  _options: ZephyrRepackPluginOptions;

  constructor(options: Omit<ZephyrRepackPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);

    // Add OTA-specific enhancements if enabled
    if (this._options.enableOTA) {
      this.addOTAEnhancements(compiler);
    }
  }

  private addOTAEnhancements(compiler: Compiler): void {
    // Add hooks for OTA-specific functionality
    compiler.hooks.emit.tapAsync(
      'ZephyrRepackOTAPlugin',
      (compilation: any, callback: any) => {
        try {
          // Generate enhanced manifest with OTA metadata
          this.generateOTAManifest(compilation);
          callback();
        } catch (error) {
          console.error('Failed to generate OTA manifest:', error);
          callback(error);
        }
      }
    );
  }

  private generateOTAManifest(compilation: any): void {
    // Enhanced manifest generation for OTA
    const manifestContent = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      ota_enabled: true,
      application_uid: this._options.applicationUid,
      dependencies: {}, // Would be populated with resolved dependencies
    };

    const manifestSource = JSON.stringify(manifestContent, null, 2);

    // Add to webpack assets
    compilation.assets['zephyr-manifest.json'] = {
      source: () => manifestSource,
      size: () => manifestSource.length,
    };

    console.log('[Zephyr OTA] Generated OTA-enhanced manifest');
  }
}
