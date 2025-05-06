import { ZephyrEngine } from 'zephyr-agent';

const pluginName = 'ZeRsbuildPlugin';

export interface ZephyrRsbuildInternalPluginOptions {
  zephyr_engine: ZephyrEngine;
  pluginName: string;
  mfConfig: any | undefined;
  wait_for_index_html?: boolean;
}

export class ZeRsbuildPlugin {
  _options: ZephyrRsbuildInternalPluginOptions;

  constructor(options: Omit<ZephyrRsbuildInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: any): void {
    console.log('Zephyr Rsbuild Plugin Options:', this._options);
    console.log('Compiler:', compiler);
  }
}
