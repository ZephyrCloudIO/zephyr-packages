import { describe, expect, it, rs } from '@rstest/core';
import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';

const mocks = rs.hoisted(() => ({ zeUploadAssets: rs.fn(), updateHashList: rs.fn() }));

rs.mock('../../edge-actions/ze-upload-assets', () => ({
  zeUploadAssets: mocks.zeUploadAssets,
}));
rs.mock('../../edge-hash-list/distributed-hash-control', () => ({
  update_hash_list: mocks.updateHashList,
}));

import { uploadAssets } from './upload-assets';

function asset(hash: string): ZeBuildAsset {
  return { path: `${hash}.js`, extname: '.js', hash, size: 1, buffer: Buffer.from(hash) };
}

describe('uploadAssets', () => {
  it('does not record bucket-only hashes as present in the edge storage', async () => {
    mocks.zeUploadAssets.mockResolvedValue(true);
    const assets = [asset('kept'), asset('stored'), asset('uploaded')];
    const assetsMap: ZeBuildAssetsMap = Object.fromEntries(
      assets.map((a) => [a.hash, a])
    );

    await uploadAssets({ application_uid: 'app' } as never, {
      assetsMap,
      missingAssets: [asset('uploaded')],
      storedHashes: new Set(['stored']),
    });

    expect(mocks.updateHashList).toHaveBeenCalledWith('app', ['kept', 'uploaded']);
  });
});
