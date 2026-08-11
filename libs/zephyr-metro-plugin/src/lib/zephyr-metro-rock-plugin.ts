import { createRequire } from 'module';
import { ZephyrError, ZeErrors } from 'zephyr-agent';
import { zephyrCommandWrapper } from './zephyr-metro-command-wrapper';

export interface ZephyrMetroRockPluginConfig {
  platforms?: Record<string, object>;
}

interface RockCommandArgv {
  platform: string;
  mode?: string;
  maxWorkers?: number;
  resetCache?: boolean;
  config?: string;
  [key: string]: unknown;
}

interface RockPluginCommandOption {
  name: string;
  description: string;
}

interface RockPluginCommand {
  name: string;
  description: string;
  action: (args: RockCommandArgv) => Promise<void>;
  options: RockPluginCommandOption[];
}

export interface RockPluginApi {
  registerCommand: (command: RockPluginCommand) => void;
  getProjectRoot: () => string;
  getPlatforms: () => Record<string, object>;
  getReactNativePath: () => string;
}

export const zephyrMetroRockPlugin =
  (pluginConfig: ZephyrMetroRockPluginConfig = {}) =>
  (api: RockPluginApi) => {
    const loadRuntimeDeps = () => {
      const runtimeRequire = createRequire(__filename);
      try {
        const { updateManifest } = runtimeRequire('@module-federation/metro') as {
          updateManifest: (manifestPath: string, mfConfig: unknown) => void;
        };
        const { default: commands } = runtimeRequire(
          '@module-federation/metro/commands'
        ) as {
          default: Record<string, any>;
        };
        return { updateManifest, commands };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message:
            'zephyrMetroRockPlugin requires @module-federation/metro. ' +
            'Install it in your app devDependencies to use this integration. ' +
            `Original error: ${detail}`,
        });
      }
    };

    const deps = loadRuntimeDeps();

    api.registerCommand({
      name: 'bundle-mf-host',
      description: 'Bundles a Module Federation host with Zephyr Cloud',
      action: async (args: RockCommandArgv) => {
        const { updateManifest, commands } = deps;
        const commandConfig = {
          root: api.getProjectRoot(),
          platforms: api.getPlatforms(),
          reactNativePath: api.getReactNativePath(),
          ...pluginConfig,
        };

        console.info(
          `Bundling Module Federation host for platform ${args.platform} with Zephyr Cloud`
        );

        const bundleZephyrHostCommand = await zephyrCommandWrapper(
          commands['bundleFederatedHost'],
          commands['loadMetroConfig'],
          () => {
            const globalState = globalThis as any;
            updateManifest(
              globalState.__METRO_FEDERATION_MANIFEST_PATH,
              globalState.__METRO_FEDERATION_CONFIG
            );
          }
        );

        await bundleZephyrHostCommand(
          [{ mode: args.mode ?? 'production', ...args } as any],
          commandConfig,
          args as any
        );
        console.info('Bundle artifacts uploaded to Zephyr.');
      },
      options: [
        ...(deps.commands['bundleFederatedHostOptions'] ?? []),
        {
          name: '--config-cmd [string]',
          description:
            '[Internal] Pass-through for Xcode build script - matches the stock Rock plugin.',
        },
      ],
    });

    api.registerCommand({
      name: 'bundle-mf-remote',
      description: 'Bundles a Module Federation remote with Zephyr Cloud',
      action: async (args: RockCommandArgv) => {
        const { updateManifest, commands } = deps;
        const commandConfig = {
          root: api.getProjectRoot(),
          platforms: api.getPlatforms(),
          reactNativePath: api.getReactNativePath(),
          ...pluginConfig,
        };

        console.info(
          `Bundling Module Federation remote for platform ${args.platform} with Zephyr Cloud`
        );

        const bundleZephyrRemoteCommand = await zephyrCommandWrapper(
          commands['bundleFederatedRemote'],
          commands['loadMetroConfig'],
          () => {
            const globalState = globalThis as any;
            updateManifest(
              globalState.__METRO_FEDERATION_MANIFEST_PATH,
              globalState.__METRO_FEDERATION_CONFIG
            );
          }
        );

        await bundleZephyrRemoteCommand(
          [{ mode: args.mode ?? 'production', ...args } as any],
          commandConfig,
          args as any
        );
        console.info('Bundle artifacts uploaded to Zephyr.');
      },
      options: deps.commands['bundleFederatedRemoteOptions'] ?? [],
    });

    return {
      name: 'zephyr-metro-rock-plugin',
      description: 'Rock plugin for Module Federation with Metro + Zephyr',
    };
  };
