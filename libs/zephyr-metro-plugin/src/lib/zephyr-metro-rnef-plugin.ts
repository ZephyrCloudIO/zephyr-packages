import { zephyrMetroReactNativeCli } from './zephyr-metro-react-native-cli';

export interface ZephyrMetroRNEFPluginConfig {
  platforms?: Record<string, object>;
}

interface RNEFCommandArgv {
  platform: string;
  mode?: string;
  maxWorkers?: number;
  resetCache?: boolean;
  config?: string;
  [key: string]: unknown;
}

interface RNEFPluginCommandOption {
  name: string;
  description: string;
}

interface RNEFPluginCommand {
  name: string;
  description: string;
  action: (args: RNEFCommandArgv) => Promise<void>;
  options: RNEFPluginCommandOption[];
}

export interface RNEFPluginApi {
  registerCommand: (command: RNEFPluginCommand) => void;
  getProjectRoot: () => string;
  getPlatforms: () => Record<string, object>;
  getReactNativePath: () => string;
}

export const zephyrMetroRNEFPlugin =
  (pluginConfig: ZephyrMetroRNEFPluginConfig = {}) =>
  (api: RNEFPluginApi) => {
    const adapter = zephyrMetroReactNativeCli({ projectRoot: api.getProjectRoot() });

    for (const command of adapter.commands) {
      api.registerCommand({
        name: command.name,
        description: command.description,
        action: (args: RNEFCommandArgv) =>
          command.func(
            [],
            {
              root: api.getProjectRoot(),
              platforms: api.getPlatforms(),
              reactNativePath: api.getReactNativePath(),
              ...pluginConfig,
            },
            args
          ),
        options: command.options,
      });
    }

    return {
      name: 'zephyr-metro-rnef-plugin',
      description: 'RNEF plugin for Module Federation with Metro + Zephyr',
    };
  };
