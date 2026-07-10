import type { BuildSuccessEvent } from '@parcel/types';
import path from 'node:path';
import {
  ZeErrors,
  ZephyrError,
  type ZephyrEngine,
  zeBuildDashData,
  type ZephyrBuildHooks,
} from 'zephyr-agent';
import { type ParcelOutputAsset, getAssetsMap } from './get-assets-map';

interface OnBuildSuccessProps {
  zephyr_engine_defer: Promise<ZephyrEngine>;
  event: BuildSuccessEvent;
  hooks?: ZephyrBuildHooks;
}

export function getParcelAssetPath(filePath: string, distDir: string): string {
  const relativePath = path.relative(distDir, filePath);
  const isOutsideDistDir =
    relativePath === '..' || relativePath.startsWith(`..${path.sep}`);
  return relativePath && !isOutsideDistDir && !path.isAbsolute(relativePath)
    ? relativePath.split(path.sep).join('/')
    : path.basename(filePath);
}

function commonOutputRoot(distDirs: readonly string[]): string | undefined {
  if (distDirs.length < 2) return undefined;
  let candidate = path.resolve(distDirs[0] ?? '.');
  while (
    !distDirs.every((distDir) => {
      const relativePath = path.relative(candidate, path.resolve(distDir));
      return (
        relativePath === '' ||
        (relativePath !== '..' &&
          !relativePath.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relativePath))
      );
    })
  ) {
    const parent = path.dirname(candidate);
    if (parent === candidate) return undefined;
    candidate = parent;
  }
  return candidate === path.parse(candidate).root ? undefined : candidate;
}

interface ParcelBundleOutput {
  filePath?: string | null;
  type: string;
  target: { distDir: string; name?: string };
}

export function collectParcelAssets(
  bundles: Iterable<ParcelBundleOutput>
): Map<string, ParcelOutputAsset> {
  const assets = new Map<string, ParcelOutputAsset>();
  const outputs = [...bundles];
  const distDirs = [
    ...new Set(outputs.map((bundle) => path.resolve(bundle.target.distDir))),
  ];
  const outputRoot = commonOutputRoot(distDirs);

  for (const bundle of outputs) {
    const filePath = bundle.filePath;
    if (!filePath) continue;

    const relativeToTarget = getParcelAssetPath(filePath, bundle.target.distDir);
    const name = outputRoot
      ? getParcelAssetPath(filePath, outputRoot)
      : distDirs.length > 1
        ? [
            bundle.target.name?.replace(/[^a-z0-9._-]/gi, '_') ||
              `${path.basename(path.dirname(bundle.target.distDir))}-${path.basename(bundle.target.distDir)}`,
            relativeToTarget,
          ].join('/')
        : relativeToTarget;
    const existing = assets.get(name);
    if (existing && path.resolve(existing.filePath) !== path.resolve(filePath)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          `Parcel emitted conflicting files for snapshot path "${name}": ` +
          `${existing.filePath} and ${filePath}`,
      });
    }
    assets.set(name, {
      name,
      filePath,
      type: bundle.type,
    });
  }

  return assets;
}

export async function onBuildSuccess(props: OnBuildSuccessProps): Promise<void> {
  const { event, zephyr_engine_defer, hooks } = props;

  const zephyr_engine = await zephyr_engine_defer;
  // create() has already allocated generation zero.
  let buildInProgress = true;

  try {
    // Start a new build
    await zephyr_engine.start_new_build();

    // Asset state belongs to one build. Reporter instances can process multiple builds.
    const assets = collectParcelAssets(event.bundleGraph.getBundles());

    // Upload assets and finish the build
    await zephyr_engine.upload_assets({
      assetsMap: getAssetsMap(assets),
      buildStats: await zeBuildDashData(zephyr_engine),
      hooks,
    });

    buildInProgress = false;
    await zephyr_engine.build_finished();
  } finally {
    if (buildInProgress && zephyr_engine.hasActiveBuild !== false) {
      zephyr_engine.build_failed();
    }
  }
}
