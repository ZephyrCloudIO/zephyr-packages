import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ZephyrEngine, logFn, ZephyrError, ZeErrors } from 'zephyr-agent';
import type { ZephyrBuildTarget } from 'zephyr-edge-contract';
import { extractAssetsFromDirectory } from '../lib/extract-assets';
import { loadPublicationMetadata } from '../lib/publication-metadata';
import { uploadAssets } from '../lib/upload';

export interface DeployOptions {
  directory: string;
  target?: ZephyrBuildTarget;
  verbose?: boolean;
  ssr?: boolean;
  /** JSON sidecar emitted by a TAP SDK or compatible bundler. */
  metadataPath?: string;
  cwd: string;
}

/**
 * Deploy command: Upload pre-built assets from a directory to Zephyr. This is similar to
 * the standalone zephyr-cli tool.
 */
export async function deployCommand(options: DeployOptions): Promise<void> {
  const { directory, target, verbose, ssr, metadataPath, cwd } = options;

  // Resolve the directory path
  const directoryPath = resolve(cwd, directory);

  // Check if directory exists
  try {
    await access(directoryPath, constants.F_OK);
  } catch {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Directory does not exist: ${directoryPath}`,
    });
  }

  if (verbose) {
    logFn('info', `Uploading assets from: ${directoryPath}`);
  }

  // Validate the SDK sidecar before opening a build session. A TAP publication must
  // never reach the upload lifecycle without its typed Federation contract.
  const publicationMetadata = await loadPublicationMetadata({
    metadataPath,
    cwd,
    target,
  });

  // Initialize ZephyrEngine with project root context
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'unknown',
    context: cwd,
    ...(target === undefined ? {} : { target }),
  });

  // Set SSR flag if specified
  if (ssr) {
    zephyr_engine.env.ssr = true;
  }

  // Extract assets from the directory
  if (verbose) {
    logFn('info', 'Extracting assets from directory...');
  }
  let assetsMap;
  try {
    assetsMap = await extractAssetsFromDirectory(directoryPath, { target });
  } catch (error: unknown) {
    if (zephyr_engine.hasActiveBuild) {
      zephyr_engine.build_failed();
    }
    throw error;
  }

  if (verbose) {
    const assetCount = Object.keys(assetsMap).length;
    logFn('info', `Found ${assetCount} assets to upload`);
  }

  // Upload assets
  await uploadAssets({
    zephyr_engine,
    assetsMap,
    publicationMetadata,
  });

  if (verbose) {
    logFn('info', 'Upload completed successfully');
  }
}
