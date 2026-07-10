import { createRequire } from 'module';
import { ZephyrError, ZeErrors } from 'zephyr-agent';
import { zephyrCommandWrapper } from './zephyr-metro-command-wrapper';

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
        const { color, logger, outro } = runtimeRequire('@rnef/tools') as {
          color: { cyan: (value: string) => string };
          logger: { info: (message: string) => void };
          outro: (message: string) => void;
        };
        return { updateManifest, commands, color, logger, outro };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message:
            'zephyrMetroRNEFPlugin requires @module-federation/metro and @rnef/tools. ' +
            'Install them in your app devDependencies to use this integration. ' +
            `Original error: ${detail}`,
        });
      }
    };

    const deps = loadRuntimeDeps();

    api.registerCommand({
      name: 'bundle-mf-host',
      description: 'Bundles a Module Federation host with Zephyr Cloud',
      action: async (args: RNEFCommandArgv) => {
        const { updateManifest, commands, color, logger, outro } = deps;
        const commandConfig = {
          root: api.getProjectRoot(),
          platforms: api.getPlatforms(),
          reactNativePath: api.getReactNativePath(),
          ...pluginConfig,
        };

        logger.info(
          `Bundling Module Federation host for platform ${color.cyan(args.platform)} with Zephyr Cloud`
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
        logger.info('Bundle artifacts uploaded to Zephyr.');
        outro('Success.');
      },
      options: [
        ...(deps.commands['bundleFederatedHostOptions'] ?? []),
        {
          name: '--config-cmd [string]',
          description:
            '[Internal] Pass-through for Xcode build script - matches the stock RNEF plugin.',
        },
      ],
    });

    api.registerCommand({
      name: 'bundle-mf-remote',
      description: 'Bundles a Module Federation remote with Zephyr Cloud',
      action: async (args: RNEFCommandArgv) => {
        const { updateManifest, commands, color, logger, outro } = deps;
        const commandConfig = {
          root: api.getProjectRoot(),
          platforms: api.getPlatforms(),
          reactNativePath: api.getReactNativePath(),
          ...pluginConfig,
        };

        logger.info(
          `Bundling Module Federation remote for platform ${color.cyan(args.platform)} with Zephyr Cloud`
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
        logger.info('Bundle artifacts uploaded to Zephyr.');
        outro('Success.');
      },
      options: deps.commands['bundleFederatedRemoteOptions'] ?? [],
    });

    return {
      name: 'zephyr-metro-rnef-plugin',
      description: 'RNEF plugin for Module Federation with Metro + Zephyr',
    };
  };
