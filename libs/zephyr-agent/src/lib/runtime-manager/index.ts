import {
  getSnapshotFileName,
  isDev,
  ZephyrRuntimeSnapshotOptions,
} from 'zephyr-edge-contract';
import { logFn } from '../logging/ze-log-event';
import { zephyr_snapshot_filename } from 'zephyr-edge-contract';
import { cyanBright } from '../logging/picocolor';

export interface RuntimeCompiler {
  webpack: {
    Compilation: { PROCESS_ASSETS_STAGE_REPORT: number };
    sources: {
      RawSource: any;
    };
  };
  rspack?: {
    Compilation: { PROCESS_ASSETS_STAGE_REPORT: number };
    sources: {
      RawSource: any;
    };
  };
}

export interface RuntimeCompilation {
  emitAsset: (name: string, source: any, assetInfo?: any) => void;
}

export interface GenerateRuntimeModuleOptions {
  disableEmit?: boolean;
  publicPath?: string;
  snapshotFileName?: string;
}

export class ZephyrRuntimeManager {
  private _zephyr_snapshot: ZephyrRuntimeSnapshotOptions | undefined;
  private _pending_snapshot = false;

  get zephyr_snapshot() {
    return this._zephyr_snapshot;
  }

  get filename() {
    return getSnapshotFileName(this._zephyr_snapshot).snapshotFileName;
  }

  init(options: ZephyrRuntimeSnapshotOptions) {
    console.log('hit zephyr runtime manager init');
    this._zephyr_snapshot = {
      snapshot: options.snapshot,
      zephyr_environment: options.zephyr_environment || '',
      filePath: options.filePath || '',
      fileName: options.fileName || '',
    };
    this._pending_snapshot = true;
  }

  async emitZephyrRuntimeSnapshot<
    XCompiler extends RuntimeCompiler,
    XCompilation extends RuntimeCompilation,
  >(
    options: GenerateRuntimeModuleOptions,
    compiler: XCompiler,
    compilation: XCompilation
  ) {
    console.log('hit zephyr runtime manager emitZephyrRuntimeSnapshot');

    const { disableEmit, publicPath } = options;

    const snapshot_filename = this.filename;
    const sourceContent = JSON.stringify(this._zephyr_snapshot, null, 2);
    const source = compiler.rspack?.sources?.RawSource
      ? new compiler.rspack.sources.RawSource(sourceContent)
      : compiler.webpack?.sources?.RawSource
        ? new compiler.webpack.sources.RawSource(sourceContent)
        : null;

    if (disableEmit) {
      return;
    }
    // Check if we have a compiler instance with rspack source
    if (!disableEmit && compilation && compiler) {
      if (!source) {
        throw new Error(
          'Could not create source for snapshot. Missing webpack or rspack sources.'
        );
      }

      compilation.emitAsset(snapshot_filename, source);
    }

    // If we have assets but no compilation, add the snapshot to the assets directly

    if (!this._zephyr_snapshot) {
      throw new Error('Zephyr snapshot is not initialized');
    }

    if (isDev()) {
      logFn(
        'info',
        `Zephyr runtime snapshot: ${cyanBright(`${publicPath === 'auto' ? '{auto}/' : publicPath}${zephyr_snapshot_filename}`)}`
      );
    }
  }
}
