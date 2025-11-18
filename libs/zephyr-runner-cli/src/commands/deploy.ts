import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ZephyrEngine, logFn, ZephyrError, ZeErrors } from 'zephyr-agent';
import { extractAssetsFromDirectory } from '../lib/extract-assets';
import { uploadAssets } from '../lib/upload';

export interface DeployOptions {
  directory: string;
  target?: 'web' | 'ios' | 'android';
  verbose?: boolean;
  ssr?: boolean;
  cwd: string;
}

/**
 * Deploy command: Upload pre-built assets from a directory to Zephyr.
 * This is similar to the standalone zephyr-cli tool.
 */
export async function deployCommand(options: DeployOptions): Promise<void> {
  const { directory, target, verbose, ssr, cwd } = options;

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

  // Initialize ZephyrEngine with project root context
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'unknown',
    context: cwd,
  });

  // Set build target if specified
  if (target) {
    zephyr_engine.env.target = target;
  }

  // Set SSR flag if specified
  if (ssr) {
    zephyr_engine.env.ssr = true;
  }

  // Extract assets from the directory
  if (verbose) {
    logFn('info', 'Extracting assets from directory...');
  }
  const assetsMap = await extractAssetsFromDirectory(directoryPath);

  if (verbose) {
    const assetCount = Object.keys(assetsMap).length;
    logFn('info', `Found ${assetCount} assets to upload`);
  }

  // Upload assets
  await uploadAssets({
    zephyr_engine,
    assetsMap,
  });

  if (verbose) {
    logFn('info', 'Upload completed successfully');
  }
}
