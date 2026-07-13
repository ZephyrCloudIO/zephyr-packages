import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import { load_public_dir } from './load_public_dir';
import { loadStaticAssets } from './load_static_assets';
import { load_static_entries } from './load_static_entries';

rs.mock('./load_public_dir', () => ({ load_public_dir: rs.fn() }));
rs.mock('./load_static_entries', () => ({ load_static_entries: rs.fn() }));

const mockLoadPublicDir = load_public_dir as Mock<typeof load_public_dir>;
const mockLoadStaticEntries = load_static_entries as Mock<typeof load_static_entries>;

const options = {
  root: '/repo',
  outDir: '/repo/dist',
  publicDir: '/repo/public',
};

describe('loadStaticAssets', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('rejects public and static assets with different bytes at the same path', async () => {
    mockLoadPublicDir.mockResolvedValue([
      {
        type: 'asset',
        fileName: 'manifest.tap.lock',
        source: Buffer.from([0x00, 0xff]),
      },
    ] as never);
    mockLoadStaticEntries.mockResolvedValue([
      {
        type: 'asset',
        fileName: 'manifest.tap.lock',
        source: Buffer.from([0x00, 0xfe]),
      },
    ] as never);

    await expect(loadStaticAssets({ ...options, target: 'tap-app' })).rejects.toThrow(
      'Vite emitted conflicting assets for "manifest.tap.lock".'
    );
  });

  it('retains one copy when public and static assets have identical bytes', async () => {
    const asset = {
      type: 'asset' as const,
      fileName: 'manifest.tap.lock',
      source: Buffer.from([0x00, 0xff]),
    };
    mockLoadPublicDir.mockResolvedValue([asset] as never);
    mockLoadStaticEntries.mockResolvedValue([
      {
        ...asset,
        source: Buffer.from(asset.source),
      },
    ] as never);

    await expect(loadStaticAssets({ ...options, target: 'tap-app' })).resolves.toEqual({
      'manifest.tap.lock': asset,
    });
  });

  it('keeps the output-directory asset for conventional Vite builds', async () => {
    const publicAsset = {
      type: 'asset' as const,
      fileName: 'remoteEntry.js',
      source: 'public copy',
    };
    const outputAsset = {
      type: 'asset' as const,
      fileName: 'remoteEntry.js',
      source: 'emitted copy',
    };
    mockLoadPublicDir.mockResolvedValue([publicAsset] as never);
    mockLoadStaticEntries.mockResolvedValue([outputAsset] as never);

    await expect(loadStaticAssets(options)).resolves.toEqual({
      'remoteEntry.js': outputAsset,
    });
  });

  it('threads the TAP target to every filesystem-backed asset source', async () => {
    mockLoadPublicDir.mockResolvedValue([]);
    mockLoadStaticEntries.mockResolvedValue([]);

    await loadStaticAssets({ ...options, target: 'tap-app' });

    expect(mockLoadPublicDir).toHaveBeenCalledWith({
      outDir: '/repo/dist',
      publicDir: '/repo/public',
      target: 'tap-app',
    });
    expect(mockLoadStaticEntries).toHaveBeenCalledWith({
      root: '/repo',
      outDir: '/repo/dist',
      target: 'tap-app',
    });
  });

  it('rejects a TAP alias before identical bytes can collapse into its canonical path', async () => {
    const bytes = Buffer.from([0x00, 0xff]);
    mockLoadPublicDir.mockResolvedValue([
      {
        type: 'asset',
        fileName: 'tap/asset-lock.json',
        source: bytes,
      },
    ] as never);
    mockLoadStaticEntries.mockResolvedValue([
      {
        type: 'asset',
        fileName: 'tap\\asset-lock.json',
        source: Buffer.from(bytes),
      },
    ] as never);

    await expect(loadStaticAssets({ ...options, target: 'tap-app' })).rejects.toThrow(
      'canonical snapshot spelling'
    );
  });
});
