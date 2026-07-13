import type { BuildSuccessEvent } from '@parcel/types';
import path from 'node:path';
import {
  ZeErrors,
  ZephyrError,
  type ZephyrEngine,
  zeBuildDashData,
  type ZephyrBuildHooks,
  type ZephyrBuildTarget,
} from 'zephyr-agent';
import type {
  ZephyrBuildStats,
  ZephyrLegacyModuleFederationConfig,
  ZephyrModuleFederationBuildMetadata,
  ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';
import { type ParcelOutputAsset, getAssetsMap } from './get-assets-map';

interface OnBuildSuccessProps {
  zephyr_engine_defer: Promise<ZephyrEngine>;
  event: BuildSuccessEvent;
  hooks?: ZephyrBuildHooks;
  mfConfigs?: ZephyrModuleFederationConfig[];
  federation?: ZephyrModuleFederationBuildMetadata[];
}

function getLegacyModuleFederationConfig(
  mfConfigs: readonly ZephyrModuleFederationConfig[] | undefined
): ZephyrLegacyModuleFederationConfig | undefined {
  const config = mfConfigs?.length === 1 ? mfConfigs[0] : undefined;
  if (
    !config ||
    typeof config.name !== 'string' ||
    !config.name.trim() ||
    typeof config.filename !== 'string' ||
    !config.filename.trim()
  ) {
    return undefined;
  }
  return config as ZephyrLegacyModuleFederationConfig;
}

export function assertTapModuleFederationMetadata(
  target: ZephyrBuildTarget | undefined,
  mfConfigs: readonly ZephyrModuleFederationConfig[] | undefined,
  federation: readonly ZephyrModuleFederationBuildMetadata[] | undefined
): void {
  if (target !== 'tap-app') return;

  const metadataError = (message: string) =>
    new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `Parcel tap-app Module Federation metadata is invalid: ${message}`,
    });
  if (!Array.isArray(mfConfigs) || mfConfigs.length === 0) {
    throw metadataError('mfConfigs must be a non-empty array.');
  }
  if (!Array.isArray(federation) || federation.length === 0) {
    throw metadataError('federation must be a non-empty array.');
  }
  if (mfConfigs.length !== federation.length) {
    throw metadataError(
      'mfConfigs and federation must contain the same number of entries.'
    );
  }

  const federationByName = new Map<string, ZephyrModuleFederationBuildMetadata>();
  const remotes = new Set<string>();
  for (const entry of federation) {
    if (typeof entry.name !== 'string' || !entry.name.trim()) {
      throw metadataError('every federation entry must have a non-empty name.');
    }
    if (typeof entry.remote !== 'string' || !entry.remote.trim()) {
      throw metadataError('every federation entry must have a non-empty remote.');
    }
    if (federationByName.has(entry.name) || remotes.has(entry.remote)) {
      throw metadataError('federation entries must not duplicate names or remotes.');
    }
    federationByName.set(entry.name, entry);
    remotes.add(entry.remote);
  }

  const names = new Set<string>();
  const filenames = new Set<string>();
  for (const config of mfConfigs) {
    if (typeof config.name !== 'string' || !config.name.trim()) {
      throw metadataError('every mfConfigs entry must have a non-empty name.');
    }
    if (typeof config.filename !== 'string' || !config.filename.trim()) {
      throw metadataError('every mfConfigs entry must have a non-empty filename.');
    }
    if (names.has(config.name) || filenames.has(config.filename)) {
      throw metadataError('mfConfigs entries must not duplicate names or filenames.');
    }
    if (federationByName.get(config.name)?.remote !== config.filename) {
      throw metadataError(
        `mfConfigs entry ${JSON.stringify(config.name)} must pair with a federation remote matching ${JSON.stringify(config.filename)}.`
      );
    }
    names.add(config.name);
    filenames.add(config.filename);
  }
}

function attachFederationBuildStats(
  buildStats: ZephyrBuildStats,
  federation: ZephyrModuleFederationBuildMetadata[] | undefined
): ZephyrBuildStats {
  if (federation === undefined) {
    return buildStats;
  }

  // The singular dashboard fields are meaningful only for one container. Clear them
  // for zero/multiple entries rather than exposing an arbitrary first target.
  const singleton = federation.length === 1 ? federation[0] : undefined;
  return {
    ...buildStats,
    federation,
    remote: singleton?.remote,
    mf_manifest: singleton?.mf_manifest,
    library_type: singleton?.library_type,
    exposes: singleton?.exposes,
    shared: singleton?.shared,
  };
}

export interface CollectParcelAssetsOptions {
  /**
   * TAP descriptors lock package-relative paths. Unlike conventional multi-target Parcel
   * deployments, those paths cannot be inferred from or prefixed with output directory
   * names.
   */
  preserveArtifactPaths?: boolean;
}

export function getParcelAssetPath(filePath: string, distDir: string): string {
  const relativePath = path.relative(distDir, filePath);
  const isOutsideDistDir =
    relativePath === '..' || relativePath.startsWith(`..${path.sep}`);
  return relativePath && !isOutsideDistDir && !path.isAbsolute(relativePath)
    ? relativePath.split(path.sep).join('/')
    : path.basename(filePath);
}

function getLockedParcelAssetPath(filePath: string, packageRoot: string): string {
  const relativePath = path.relative(packageRoot, filePath);
  const isOutsidePackageRoot =
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath);
  if (isOutsidePackageRoot) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        `Parcel emitted TAP artifact outside its package-root distDir: "${filePath}". ` +
        `Expected a path under "${packageRoot}".`,
    });
  }
  return relativePath.split(path.sep).join('/');
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
  bundles: Iterable<ParcelBundleOutput>,
  { preserveArtifactPaths = false }: CollectParcelAssetsOptions = {}
): Map<string, ParcelOutputAsset> {
  const assets = new Map<string, ParcelOutputAsset>();
  const outputs = [...bundles];
  const distDirs = [
    ...new Set(outputs.map((bundle) => path.resolve(bundle.target.distDir))),
  ];
  const outputRoot = commonOutputRoot(distDirs);

  if (preserveArtifactPaths && distDirs.length > 1) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'Parcel tap-app publication requires one package-root distDir. ' +
        'Multiple output directories would require rewriting SDK-locked artifact paths.',
    });
  }

  for (const bundle of outputs) {
    const filePath = bundle.filePath;
    if (!filePath) continue;

    const relativeToTarget = preserveArtifactPaths
      ? getLockedParcelAssetPath(filePath, bundle.target.distDir)
      : getParcelAssetPath(filePath, bundle.target.distDir);
    const name = preserveArtifactPaths
      ? relativeToTarget
      : outputRoot
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
  const { event, zephyr_engine_defer, hooks, mfConfigs, federation } = props;

  const zephyr_engine = await zephyr_engine_defer;
  assertTapModuleFederationMetadata(zephyr_engine.env?.target, mfConfigs, federation);
  // create() has already allocated generation zero.
  let buildInProgress = true;

  try {
    // Start a new build
    await zephyr_engine.start_new_build();

    // Asset state belongs to one build. Reporter instances can process multiple builds.
    const assets = collectParcelAssets(event.bundleGraph.getBundles(), {
      preserveArtifactPaths: zephyr_engine.env?.target === 'tap-app',
    });

    // Upload assets and finish the build
    const mfConfig = getLegacyModuleFederationConfig(mfConfigs);
    await zephyr_engine.upload_assets({
      assetsMap: getAssetsMap(assets),
      buildStats: attachFederationBuildStats(
        await zeBuildDashData(zephyr_engine),
        federation
      ),
      ...(mfConfig ? { mfConfig } : {}),
      ...(mfConfigs ? { mfConfigs } : {}),
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
