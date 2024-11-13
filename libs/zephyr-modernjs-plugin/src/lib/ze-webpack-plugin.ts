import type { Compiler } from 'webpack';
import * as isCI from 'is-ci';
import { ZephyrPluginOptions } from 'zephyr-edge-contract';

import { setupZephyrConfig } from './ze-setup-build-id';
import { logBuildSteps } from './ze-setup-build-steps-logging';
import { setupZeDeploy } from './ze-setup-ze-deploy';

const pluginName = 'ZeWebpackPlugin';

const default_zewebpack_options = {
  pluginName,
  isCI,
  buildEnv: isCI ? 'ci' : 'local',
  zeConfig: {},
  app: {},
  git: {},
};

export class ZeWebpackPlugin {
  _options = default_zewebpack_options as ZephyrPluginOptions;

  constructor(options = {}) {
    this._options = Object.assign(this._options, options ?? {});
  }

  apply(compiler: Compiler): void {
    setupZephyrConfig(this._options, compiler);
    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
