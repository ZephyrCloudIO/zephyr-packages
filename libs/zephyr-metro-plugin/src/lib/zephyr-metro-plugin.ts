import {
  buildAssetsMap,
  Platform,
  ze_log,
  ZeBuildAssetsMap,
  ZephyrEngine,
} from 'zephyr-agent';
import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { extract_remotes_dependencies } from './internal/extract-mf-remotes';
import { load_static_entries, OutputAsset } from './internal/load_static_entries';
import { mutateMfConfig } from './internal/mutate_mf_config';
import {
  extractModulesFromExposes,
  getPackageDependencies,
  resolveCatalogDependencies,
} from './internal/resolveCatalogDependencies';
import { create_minimal_build_stats } from './internal/ze-minimal-build-stats';
export interface ZephyrCommandWrapperConfig {
  platform: Platform;
  mode: string;
  context: string;
  outDir: string;
  mfConfig: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];
}

export class ZephyrMetroPlugin {
  private config: ZephyrCommandWrapperConfig;
  private zephyr_engine!: ZephyrEngine;

  constructor(props: ZephyrCommandWrapperConfig) {
    this.config = props;
  }

  public async beforeBuild() {
    this.zephyr_engine = await ZephyrEngine.create({
      builder: 'metro',
      context: this.config.context,
    });
    ze_log('Configuring with Zephyr... \n config: ', this.config);

    this.zephyr_engine.env.target = this.config.platform;

    const dependency_pairs = extract_remotes_dependencies(this.config.mfConfig?.remotes);

    ze_log(
      'Resolving and building towards target by zephyr_engine.env.target: ',
      this.zephyr_engine.env.target
    );

    const resolved_dependency_pairs =
      await this.zephyr_engine.resolve_remote_dependencies(dependency_pairs);

    if (this.config.mfConfig) {
      ze_log('Mutating MF config...');
      mutateMfConfig(this.zephyr_engine, this.config.mfConfig, resolved_dependency_pairs);
    }

    ze_log('dependency resolution completed successfully...or at least trying to...');

    ze_log('Application uid created...');

    return this.config.mfConfig;
  }

  private async getBuildStats() {
    ze_log('Extracting Metro build stats');

    const minimal_build_stats = await create_minimal_build_stats(this.zephyr_engine);

    Object.assign(minimal_build_stats, {
      name: this.config.mfConfig?.name || this.zephyr_engine.applicationProperties.name,
      remote: this.config.mfConfig?.filename || 'remoteEntry.js',
      remotes: this.config.mfConfig?.remotes
        ? Object.keys(this.config.mfConfig.remotes)
        : [],
      metadata: {
        hasFederation: !!this.config.mfConfig,
      },
    });

    // Extract shared dependencies from Module Federation config
    const overrides = this.config.mfConfig?.shared
      ? Object.entries(this.config.mfConfig.shared).map(([name, config]) => {
          // Module Federation allows shared to be an object, array, or string
          // Get version from package dependencies if available or from config
          let version = '0.0.0';

          if (this.zephyr_engine.npmProperties.dependencies?.[name]) {
            // Resolve catalog reference in dependencies if present
            const depVersion = this.zephyr_engine.npmProperties.dependencies[name];
            version = depVersion.startsWith('catalog:')
              ? resolveCatalogDependencies({ [name]: depVersion })[name]
              : depVersion;
          } else if (this.zephyr_engine.npmProperties.peerDependencies?.[name]) {
            // Resolve catalog reference in peer dependencies if present
            const peerVersion = this.zephyr_engine.npmProperties.peerDependencies[name];
            version = peerVersion.startsWith('catalog:')
              ? resolveCatalogDependencies({ [name]: peerVersion })[name]
              : peerVersion;
          } else if (typeof config === 'object' && config !== null) {
            // Object format: { react: { requiredVersion: '18.0.0', singleton: true } }
            if ((config as { requiredVersion: string }).requiredVersion) {
              const reqVersion = (config as { requiredVersion: string }).requiredVersion;

              if (reqVersion) {
                version =
                  typeof reqVersion === 'string' && reqVersion.startsWith('catalog:')
                    ? resolveCatalogDependencies({ [name]: reqVersion })[name]
                    : reqVersion;
              }
            }
          } else if (typeof config === 'string') {
            // String format: { react: '18.0.0' }
            // Only use string value if we didn't find the package in dependencies
            if (
              !this.zephyr_engine.npmProperties.dependencies?.[name] &&
              !this.zephyr_engine.npmProperties.peerDependencies?.[name]
            ) {
              version = config.startsWith('catalog:')
                ? resolveCatalogDependencies({ [name]: config })[name]
                : config;
            }
          }
          // Array format is also possible but doesn't typically include version info

          return {
            id: name,
            name,
            version,
            location: name,
            applicationID: name,
          };
        })
      : [];

    // Build the stats object
    const buildStats = {
      ...minimal_build_stats,
      overrides,
      modules: extractModulesFromExposes(
        this.config.mfConfig,
        this.zephyr_engine.application_uid
      ),
      // Module Federation related data
      dependencies: getPackageDependencies(
        resolveCatalogDependencies(this.zephyr_engine.npmProperties.dependencies)
      ),
      devDependencies: getPackageDependencies(
        resolveCatalogDependencies(this.zephyr_engine.npmProperties.devDependencies)
      ),
      optionalDependencies: getPackageDependencies(
        resolveCatalogDependencies(this.zephyr_engine.npmProperties.optionalDependencies)
      ),
      peerDependencies: getPackageDependencies(
        resolveCatalogDependencies(this.zephyr_engine.npmProperties.peerDependencies)
      ),
    };

    return buildStats;
  }

  public async afterBuild() {
    await this.zephyr_engine.start_new_build();

    const assetsMap = await this.makeAssetsMap();

    const buildStats = await this.getBuildStats();

    ze_log('Build stats: ', buildStats);

    await this.zephyr_engine.upload_assets({
      assetsMap,
      buildStats,
      mfConfig: this.config.mfConfig,
    });
    await this.zephyr_engine.build_finished();
  }

  private async loadStaticAssets(): Promise<Record<string, OutputAsset>> {
    const assets = await load_static_entries({
      root: this.config.context,
      outDir: this.config.outDir,
    });

    return assets.reduce((acc, asset) => {
      acc[asset.fileName] = asset;
      return acc;
    }, {} as any);
  }

  private async makeAssetsMap(): Promise<ZeBuildAssetsMap> {
    const assets = await this.loadStaticAssets();

    return buildAssetsMap(assets, this.extractBuffer, this.getAssetType);
  }

  private extractBuffer(asset: OutputAsset): string | undefined {
    return asset.source.toString();
  }

  private getAssetType(asset: OutputAsset): string {
    return asset.type;
  }
}
