type RsbuildOnBeforeCreateCompilerArgs = {
  bundlerConfigs?: RspackConfig[];
};

type RspackConfig = {
  name?: string;
  output?: {
    publicPath?: unknown;
  };
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

type RspackModuleFederationPlugin = {
  name?: string;
  _options?: ModuleFederationOptions;
};

const RSPACK_MODULE_FEDERATION_PLUGIN_NAME = 'RspackModuleFederationPlugin';

export const ZEPHYR_RSPRESS_MODULE_FEDERATION_GET_PUBLIC_PATH = [
  'var scriptUrl;',
  'if (typeof document !== "undefined") {',
  '  var currentScript = document.currentScript;',
  '  if (currentScript && currentScript.tagName === "SCRIPT") {',
  '    scriptUrl = currentScript.src;',
  '  }',
  '  if (!scriptUrl) {',
  '    var scripts = document.getElementsByTagName("script");',
  '    if (scripts.length) {',
  '      scriptUrl = scripts[scripts.length - 1].src;',
  '    }',
  '  }',
  '}',
  'if (!scriptUrl && typeof location !== "undefined") {',
  '  scriptUrl = location.href;',
  '}',
  'if (!scriptUrl) {',
  '  return "/";',
  '}',
  'return scriptUrl',
  '  .replace(/#.*$/, "")',
  '  .replace(/\\?.*$/, "")',
  '  .replace(/\\/[^\\/]*$/, "/");',
].join('\n');

export function moduleFederationPublicPathPlugin(): RsbuildPlugin {
  return {
    name: 'zephyr-rspress-module-federation-public-path',
    setup(api) {
      api.onBeforeCreateCompiler({
        order: 'post',
        handler({ bundlerConfigs }) {
          for (const config of bundlerConfigs ?? []) {
            setPortableModuleFederationPublicPath(config);
          }
        },
      });
    },
  };
}

export function setPortableModuleFederationPublicPath(config: RspackConfig): void {
  const hasRemote = setModuleFederationGetPublicPath(config.plugins);

  if (hasRemote && isHttpPublicPath(config.output?.publicPath)) {
    config.output = {
      ...config.output,
      publicPath: '/',
    };
  }
}

export function setModuleFederationGetPublicPath(plugins: unknown[] = []): boolean {
  let hasRemote = false;

  for (const plugin of plugins) {
    const options = getModuleFederationOptions(plugin);

    if (!options || !hasExposes(options.exposes)) {
      continue;
    }

    hasRemote = true;

    if (!options.getPublicPath) {
      options.getPublicPath = ZEPHYR_RSPRESS_MODULE_FEDERATION_GET_PUBLIC_PATH;
    }
  }

  return hasRemote;
}

function getModuleFederationOptions(plugin: unknown): ModuleFederationOptions | null {
  if (!isRecord(plugin)) {
    return null;
  }

  const candidate = plugin as RspackModuleFederationPlugin;

  if (candidate.name !== RSPACK_MODULE_FEDERATION_PLUGIN_NAME) {
    return null;
  }

  return isRecord(candidate._options) ? candidate._options : null;
}

function hasExposes(exposes: unknown): boolean {
  if (!exposes) {
    return false;
  }

  if (Array.isArray(exposes)) {
    return exposes.length > 0;
  }

  if (isRecord(exposes)) {
    return Object.keys(exposes).length > 0;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHttpPublicPath(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//.test(value);
}
