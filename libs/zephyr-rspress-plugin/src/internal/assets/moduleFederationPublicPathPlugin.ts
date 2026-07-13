import {
  isModuleFederationPlugin,
  type ModuleFederationPlugin,
} from 'zephyr-xpack-internal';
import type { ZephyrBuildTarget } from 'zephyr-agent';

type RsbuildOnBeforeCreateCompilerArgs = {
  bundlerConfigs?: RspackConfig[];
};

type RspackConfig = {
  name?: string;
  output?: { publicPath?: unknown };
  plugins?: unknown[];
};

type RsbuildPluginApi = {
  onBeforeCreateCompiler: (options: {
    order: 'post';
    handler: (args: RsbuildOnBeforeCreateCompilerArgs) => void;
  }) => void;
};

type RsbuildPlugin = {
  name: string;
  setup: (api: RsbuildPluginApi) => void;
};

type ModuleFederationOptions = {
  exposes?: unknown;
  getPublicPath?: string;
};

type ModuleFederationPluginLike = {
  name?: string;
  constructor?: { name?: string };
  _options?: ModuleFederationOptions | { config?: ModuleFederationOptions };
};

export interface ModuleFederationPublicPathPluginOptions {
  /** TAP artifacts are SDK-locked and must retain their emitted public path verbatim. */
  target?: ZephyrBuildTarget;
  /**
   * Receives every Module Federation plugin materialized across Rspress's compilers. The
   * SSG upload runs later and uses this reference to publish snapshot and build-stat
   * federation metadata without selecting an arbitrary first compiler.
   */
  onModuleFederationPlugins?: (plugins: ModuleFederationPlugin[]) => void;
}

export function moduleFederationPublicPathPlugin(
  options: ModuleFederationPublicPathPluginOptions = {}
): RsbuildPlugin {
  return {
    name: 'zephyr-rspress-module-federation-public-path',
    setup(api) {
      api.onBeforeCreateCompiler({
        order: 'post',
        handler({ bundlerConfigs }) {
          const configs = bundlerConfigs ?? [];
          options.onModuleFederationPlugins?.(
            configs.flatMap((config) =>
              (config.plugins ?? []).filter((plugin): plugin is ModuleFederationPlugin =>
                isModuleFederationPlugin(plugin as never)
              )
            )
          );

          if (options.target !== 'tap-app') {
            for (const config of configs) {
              setPortableModuleFederationPublicPath(config);
            }
          }
        },
      });
    },
  };
}

/**
 * Rspress SSG produces separate browser and node compilers. Native `auto` public paths
 * make browser chunks resolve from their loading script without injecting a
 * `getPublicPath`/`new Function` runtime. The node compiler deliberately retains its
 * required absolute public path; Module Federation's Rspress integration rejects `/` and
 * `auto` for that compiler.
 */
export function setPortableModuleFederationPublicPath(config: RspackConfig): void {
  if (config.name === 'node' || !hasExposedModuleFederationRemote(config.plugins)) {
    return;
  }

  if (isHttpPublicPath(config.output?.publicPath)) {
    config.output = { ...config.output, publicPath: 'auto' };
  }
}

function hasExposedModuleFederationRemote(plugins: unknown[] = []): boolean {
  return plugins.some((plugin) => {
    const options = getModuleFederationOptions(plugin);
    return Boolean(options && hasExposes(options.exposes));
  });
}

function getModuleFederationOptions(plugin: unknown): ModuleFederationOptions | null {
  if (!isRecord(plugin)) {
    return null;
  }

  const candidate = plugin as ModuleFederationPluginLike;
  const pluginName = candidate.name ?? candidate.constructor?.name;
  if (!pluginName?.includes('ModuleFederationPlugin')) {
    return null;
  }

  const rawOptions = candidate._options;
  if (!isRecord(rawOptions)) {
    return null;
  }
  const nestedConfig = (rawOptions as Record<string, unknown>)['config'];
  return isRecord(nestedConfig)
    ? (nestedConfig as ModuleFederationOptions)
    : (rawOptions as ModuleFederationOptions);
}

function hasExposes(exposes: unknown): boolean {
  if (Array.isArray(exposes)) {
    return exposes.length > 0;
  }
  return isRecord(exposes) ? Object.keys(exposes).length > 0 : false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHttpPublicPath(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}
