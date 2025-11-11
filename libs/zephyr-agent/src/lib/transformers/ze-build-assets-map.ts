import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';

import { transformSync } from '@swc/core';
import { ze_log } from '../logging';
import { zeBuildAssets } from './ze-build-assets';

interface ExtractBuffer<T> {
  (asset: T): Buffer | string | undefined;
}

interface GetAssetType<T> {
  (asset: T): string;
}

export type { ZeBuildAssetsMap } from 'zephyr-edge-contract';

export function buildAssetsMapMock<T>(
  assets: Record<string, T>,
  extractBuffer: ExtractBuffer<T>,
  getAssetType: GetAssetType<T>
) {
  return Object.keys(assets).reduce((memo, filepath) => {
    const asset = assets[filepath];
    let buffer = extractBuffer(asset);

    if (!buffer && buffer !== '') {
      ze_log.upload(`unknown asset type: ${getAssetType(asset)}`);
      return memo;
    }

    if (filepath.endsWith('.js')) {
      const content = buffer.toString();
      console.log('original content: ', content);
      const compiled = transformSync(content, {
        jsc: {
          target: 'esnext',
          transform: {
            optimizer: {
              globals: {
                envs: {
                  ZE_PUBLIC_LOG: '0',
                  ZE_PUBLIC_COND: '0',
                },
              },
            },
          },
          minify: {
            // compress: true,
            // mangle: true,
          },
        },
        // minify: true,
      });
      console.log('compiled content: ', compiled.code);
      buffer = compiled.code;
    }

    const assetMap = zeBuildAssets({ filepath, content: buffer });
    memo[assetMap.hash] = assetMap;

    return memo;
  }, {} as ZeBuildAssetsMap);
}
