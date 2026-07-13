import { ZeErrors, ZephyrError, type ZephyrBuildTarget } from 'zephyr-agent';
import type { ZephyrOutput, ZephyrOutputBundle } from '../types/zephyr-output';
import { normalizeVitePath } from '../utils/normalize-vite-path';

function outputBytes(asset: ZephyrOutput): Buffer {
  if (asset.type === 'chunk') {
    return Buffer.from(asset.code, 'utf8');
  }

  return typeof asset.source === 'string'
    ? Buffer.from(asset.source, 'utf8')
    : Buffer.from(asset.source);
}

function hasSameBytes(left: ZephyrOutput, right: ZephyrOutput): boolean {
  return outputBytes(left).equals(outputBytes(right));
}

export interface MergeViteOutputAssetsOptions {
  /** TAP paths are protocol values and must already use their published spelling. */
  target?: ZephyrBuildTarget;
}

/**
 * Merge emitted Vite assets without allowing a later source to hide different bytes at
 * the same snapshot path. Exact duplicates are harmless and retained from the first
 * source.
 */
export function mergeViteOutputAssets(
  bundle: ZephyrOutputBundle,
  assets: Iterable<readonly [string, ZephyrOutput]>,
  { target }: MergeViteOutputAssetsOptions = {}
): void {
  for (const [assetPath, asset] of assets) {
    const normalizedPath = normalizeVitePath(assetPath);
    // Rollup/Vite bundle keys are logical POSIX paths, not local filesystem paths.
    // Reject a backslash spelling before lookup/normalization so two byte-identical
    // aliases cannot collapse into one apparently valid locked artifact.
    if (target === 'tap-app' && assetPath !== normalizedPath) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          `Vite TAP artifact path must use its canonical snapshot spelling: ` +
          `${JSON.stringify(assetPath)} (expected ${JSON.stringify(normalizedPath)}).`,
      });
    }
    const existing = bundle[normalizedPath];
    if (existing) {
      if (!hasSameBytes(existing, asset)) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message: `Vite emitted conflicting assets for "${normalizedPath}".`,
        });
      }
      continue;
    }

    bundle[normalizedPath] = asset;
  }
}
