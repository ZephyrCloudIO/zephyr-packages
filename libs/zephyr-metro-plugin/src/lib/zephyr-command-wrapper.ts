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

    ze_log(
      'dependency resolution completed successfully...or at least trying to...',
      resolved_dependency_pairs
    );

    ze_log('Application uid created...');
  }

  private async getBuildStats() {
    ze_log('Extracting Metro build stats');

    ze_log('No bundle found, returning minimal stats');

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
    return minimal_build_stats;
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
