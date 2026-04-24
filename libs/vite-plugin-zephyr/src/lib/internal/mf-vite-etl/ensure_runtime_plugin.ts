import * as fs from 'fs';
import * as path from 'path';

export interface ModuleFederationRemoteConfig {
  name: string;
  entry: string;
  type?: string;
  [key: string]: unknown;
}

export interface ModuleFederationOptions {
  name?: string;
  filename?: string;
  remotes?: Record<string, string | ModuleFederationRemoteConfig>;
  exposes?: Record<string, string>;
  runtimePlugins?: string[];
  shared?: Record<string, unknown>;
  dts?: boolean | Record<string, unknown>;
  [key: string]: unknown;
}

export const ZEPHYR_MF_RUNTIME_PLUGIN_ID = 'virtual:zephyr-mf-runtime-plugin';
export const RESOLVED_ZEPHYR_MF_RUNTIME_PLUGIN_ID = `\0${ZEPHYR_MF_RUNTIME_PLUGIN_ID}`;

export function getRuntimePluginPath() {
  const cwd = process.cwd();
  const candidates = [
    path.join(
      cwd,
      'node_modules',
      'vite-plugin-zephyr',
      'dist',
      'lib',
      'internal',
      'mf-vite-etl',
      'runtime_plugin.mjs'
    ),
    path.join(
      cwd,
      'libs',
      'vite-plugin-zephyr',
      'src',
      'lib',
      'internal',
      'mf-vite-etl',
      'runtime_plugin.mjs'
    ),
  ];

  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  return existing ?? candidates[0];
}

export function ensureRuntimePlugin(
  mfConfig: ModuleFederationOptions
): ModuleFederationOptions {
  const runtimePlugins = [...(mfConfig.runtimePlugins ?? [])];

  if (!runtimePlugins.includes(ZEPHYR_MF_RUNTIME_PLUGIN_ID)) {
    // MF serializes runtime plugins into remoteEntry.js, so inject ours before build.
    runtimePlugins.push(ZEPHYR_MF_RUNTIME_PLUGIN_ID);
  }

  mfConfig.runtimePlugins = runtimePlugins;
  return mfConfig;
}
