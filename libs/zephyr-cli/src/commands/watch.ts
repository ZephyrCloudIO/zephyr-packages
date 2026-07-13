import { watch } from 'node:fs';
import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ZeErrors, ZephyrEngine, ZephyrError, logFn } from 'zephyr-agent';
import type { ZephyrBuildTarget } from 'zephyr-edge-contract';
import { extractAssetsFromDirectory } from '../lib/extract-assets';
import { loadPublicationMetadata } from '../lib/publication-metadata';
import { SequentialPublisher } from '../lib/sequential-publisher';
import { uploadAssets } from '../lib/upload';

export interface WatchOptions {
  directory: string;
  target?: ZephyrBuildTarget;
  verbose?: boolean;
  ssr?: boolean;
  /** Wait for this long after the most recent filesystem event before publishing. */
  debounceMs?: number;
  /** JSON sidecar emitted by a TAP SDK or compatible bundler. */
  metadataPath?: string;
  cwd: string;
}

const DEFAULT_DEBOUNCE_MS = 250;

/**
 * Watches a pre-built output directory and publishes a new immutable Zephyr snapshot
 * after each settled output change. The control plane remains the authority that advances
 * an authorized development tag; this command only publishes the complete mini-app output
 * and never fabricates a mutable tag locally.
 */
export async function watchCommand(options: WatchOptions): Promise<void> {
  const { directory, target, verbose, ssr, metadataPath, cwd } = options;
  const directoryPath = resolve(cwd, directory);
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  if (target !== 'tap-app') {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message:
        'The watch command is reserved for mini-app development and requires --target tap-app.',
    });
  }

  if (!Number.isSafeInteger(debounceMs) || debounceMs < 0) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Watch debounce must be a non-negative integer, received ${String(debounceMs)}.`,
    });
  }

  try {
    await access(directoryPath, constants.F_OK);
  } catch {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Directory does not exist: ${directoryPath}`,
    });
  }

  // Refuse an incomplete TAP publication before allocating a long-lived watcher. The
  // sidecar is read again for every snapshot below because SDK output can change.
  await loadPublicationMetadata({ metadataPath, cwd, target });

  const log = (message: string) => {
    if (verbose) logFn('info', message);
  };

  const zephyrEngine = await ZephyrEngine.create({
    builder: 'unknown',
    context: cwd,
    target,
  });
  if (ssr) zephyrEngine.env.ssr = true;

  const publisher = new SequentialPublisher(async () => {
    log(`Collecting changed output from ${directoryPath}`);
    const assetsMap = await extractAssetsFromDirectory(directoryPath, { target });
    const assetCount = Object.keys(assetsMap).length;
    if (assetCount === 0) {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: `Refusing to publish an empty output directory: ${directoryPath}`,
      });
    }
    // Read this for every immutable snapshot so a rebuilt SDK sidecar cannot become
    // stale relative to the package output it describes.
    const publicationMetadata = await loadPublicationMetadata({
      metadataPath,
      cwd,
      target,
    });
    log(`Publishing ${assetCount} assets as ${target}`);
    await uploadAssets({ zephyr_engine: zephyrEngine, assetsMap, publicationMetadata });
  });

  // Give developers a confirmed baseline before accepting incremental file events.
  await publisher.request();
  log(
    `Watching ${directoryPath} for mini-app output changes (debounce ${debounceMs}ms).`
  );

  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  const schedulePublication = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void publisher.request().catch((error: unknown) => {
        logFn('error', ZephyrError.format(error));
      });
    }, debounceMs);
  };

  let watcher: ReturnType<typeof watch>;
  try {
    watcher = watch(directoryPath, { recursive: true }, schedulePublication);
  } catch (cause) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message:
        `Could not watch ${directoryPath}. Use a Node runtime with recursive filesystem watch support. ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    });
  }

  let stop: () => void;
  try {
    await new Promise<void>((resolveWatch, rejectWatch) => {
      stop = () => {
        if (stopped) return;
        stopped = true;
        if (timer) clearTimeout(timer);
        resolveWatch();
      };
      watcher.once('error', rejectWatch);
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
  } finally {
    stopped = true;
    if (timer) clearTimeout(timer);
    watcher.close();
    process.off('SIGINT', stop!);
    process.off('SIGTERM', stop!);
  }

  await publisher.waitForIdle();
}
