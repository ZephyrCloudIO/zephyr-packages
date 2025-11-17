#!/usr/bin/env node

import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { ZephyrEngine, logFn, ZephyrError, ZeErrors } from 'zephyr-agent';
import { parseArgs } from './cli';
import { extractAssetsFromDirectory } from './lib/extract-assets';
import { uploadAssets } from './lib/upload';

async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    // Resolve the directory path
    const directoryPath = resolve(cwd(), options.directory);

    // Check if directory exists
    try {
      await access(directoryPath, constants.F_OK);
    } catch {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: `Directory does not exist: ${directoryPath}`,
      });
    }

    if (options.verbose) {
      logFn('info', `Uploading assets from: ${directoryPath}`);
    }

    // Initialize ZephyrEngine with project root context
    // ZephyrEngine will auto-detect:
    // - Application properties from package.json and git
    // - Git information from repository
    // - NPM dependencies from package.json
    // - Application configuration from Zephyr API
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'unknown',
      context: cwd(), // Use project root, not the dist directory
    });

    // Set build target if specified
    if (options.target) {
      zephyr_engine.env.target = options.target;
    }

    // Set SSR flag if specified
    if (options.ssr) {
      zephyr_engine.env.ssr = true;
    }

    // Extract assets from the directory
    if (options.verbose) {
      logFn('info', 'Extracting assets from directory...');
    }
    const assetsMap = await extractAssetsFromDirectory(directoryPath);

    if (options.verbose) {
      const assetCount = Object.keys(assetsMap).length;
      logFn('info', `Found ${assetCount} assets to upload`);
    }

    // Upload assets
    await uploadAssets({
      zephyr_engine,
      assetsMap,
    });

    if (options.verbose) {
      logFn('info', 'Upload completed successfully');
    }
  } catch (error) {
    logFn('error', ZephyrError.format(error));
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  logFn('error', ZephyrError.format(error));
  process.exit(1);
});
