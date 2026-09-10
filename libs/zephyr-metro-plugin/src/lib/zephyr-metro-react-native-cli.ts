import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ZephyrError, ZeErrors } from 'zephyr-agent';
import { zephyrCommandWrapper } from './zephyr-metro-command-wrapper';

interface ReactNativeCliCommandOptions {
  mode?: string;
  platform: string;
  maxWorkers?: number;
  resetCache?: boolean;
  config?: string;
  [key: string]: unknown;
}

interface ReactNativeCliConfig {
  root: string;
  platforms: Record<string, object>;
  reactNativePath: string;
  [key: string]: unknown;
}

interface ReactNativeCliCommandOption {
  name: string;
  description: string;
  default?: string | boolean | number;
  parse?: (value: string) => unknown;
}

export interface ReactNativeCliCommand {
  name: string;
  description: string;
  func: (
    argv: string[],
    config: ReactNativeCliConfig,
    args: ReactNativeCliCommandOptions
  ) => Promise<void>;
  options: ReactNativeCliCommandOption[];
}

export interface ZephyrMetroReactNativeCliConfig {
  projectRoot?: string;
}

export interface ZephyrMetroReactNativeCliAdapter {
  commands: ReactNativeCliCommand[];
}

export function zephyrMetroReactNativeCli(
  adapterConfig: ZephyrMetroReactNativeCliConfig = {}
): ZephyrMetroReactNativeCliAdapter {
  const projectRoot = adapterConfig.projectRoot ?? process.cwd();
  const runtimeRequire = createRequire(join(projectRoot, 'package.json'));

  try {
    const { updateManifest } = runtimeRequire('@module-federation/metro') as {
      updateManifest: (manifestPath: string, mfConfig: unknown) => void;
    };
    const { default: commands } = runtimeRequire('@module-federation/metro/commands') as {
      default: Record<string, any>;
    };

    const createCommand = (
      name: 'bundle-mf-host' | 'bundle-mf-remote',
      commandName: 'bundleFederatedHost' | 'bundleFederatedRemote',
      optionsName: 'bundleFederatedHostOptions' | 'bundleFederatedRemoteOptions'
    ): ReactNativeCliCommand => ({
      name,
      description: `Bundles a Module Federation ${name.endsWith('host') ? 'host' : 'remote'} with Zephyr Cloud`,
      func: async (argv, config, args) => {
        console.info(
          `Bundling Module Federation ${name.endsWith('host') ? 'host' : 'remote'} for platform ${args.platform} with Zephyr Cloud`
        );

        const bundleWithZephyr = await zephyrCommandWrapper(
          commands[commandName],
          commands['loadMetroConfig'],
          () => {
            const globalState = globalThis as any;
            updateManifest(
              globalState.__METRO_FEDERATION_MANIFEST_PATH,
              globalState.__METRO_FEDERATION_CONFIG
            );
          }
        );

        await bundleWithZephyr(
          [{ mode: args.mode ?? 'production', ...args } as any],
          config as any,
          args as any
        );
        console.info('Bundle artifacts uploaded to Zephyr.');
        console.info('Success.');
      },
      options: commands[optionsName] ?? [],
    });

    const hostCommand = createCommand(
      'bundle-mf-host',
      'bundleFederatedHost',
      'bundleFederatedHostOptions'
    );
    hostCommand.options = [
      ...hostCommand.options,
      {
        name: '--config-cmd [string]',
        description:
          '[Internal] Pass-through for Xcode build script - matches the stock RNEF plugin.',
      },
    ];

    return {
      commands: [
        hostCommand,
        createCommand(
          'bundle-mf-remote',
          'bundleFederatedRemote',
          'bundleFederatedRemoteOptions'
        ),
      ],
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message:
        'zephyrMetroReactNativeCli requires @module-federation/metro. ' +
        'Install it in your app devDependencies to use this integration. ' +
        `Original error: ${detail}`,
    });
  }
}
