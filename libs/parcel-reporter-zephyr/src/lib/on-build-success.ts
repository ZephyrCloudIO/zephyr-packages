import type { BuildSuccessEvent } from '@parcel/types';
import path from 'path';
import { getAssetsMap, type ParcelOutputAsset } from './get-assets-map';
import { zeBuildDashData, type ZephyrEngine } from 'zephyr-agent';

const assets = new Map<string, ParcelOutputAsset>();

interface OnBuildSuccessProps {
  zephyr_engine_defer: Promise<ZephyrEngine>;
  event: BuildSuccessEvent;
}

export async function onBuildSuccess(props: OnBuildSuccessProps): Promise<void> {
  const { event, zephyr_engine_defer } = props;

  const zephyr_engine = await zephyr_engine_defer;

  // Start a new build
  await zephyr_engine.start_new_build();

  // Collect assets from the build
  event.bundleGraph.getBundles().forEach((bundle) => {
    const filePath = bundle.filePath;
    if (!filePath) return;

    const name = path.basename(filePath);

    assets.set(name, {
      name: name,
      filePath,
      type: bundle.type,
    });
  });

  // Upload assets and finish the build
  await zephyr_engine.upload_assets({
    assetsMap: getAssetsMap(assets),
    buildStats: await zeBuildDashData(zephyr_engine),
  });

  await zephyr_engine.build_finished();
}
