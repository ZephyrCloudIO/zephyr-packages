import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getAssetsMap, type ParcelOutputAsset } from './get-assets-map';
import { collectParcelAssets, getParcelAssetPath } from './on-build-success';

rs.mock('zephyr-agent', () => ({
  ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
  ZephyrError: class extends Error {
    constructor(_type: unknown, options?: { message?: string }) {
      super(options?.message ?? String(_type));
    }
  },
  buildAssetsMap: (
    assets: Record<string, ParcelOutputAsset>,
    extractBuffer: (asset: ParcelOutputAsset) => Buffer | string | undefined
  ) =>
    Object.fromEntries(
      Object.entries(assets).map(([assetPath, asset]) => [
        assetPath,
        { path: assetPath, buffer: extractBuffer(asset) },
      ])
    ),
  zeBuildDashData: rs.fn(),
  ze_log: { upload: rs.fn() },
}));

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Parcel asset collection', () => {
  it('preserves binary bytes without mutating caller-owned assets', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'zephyr-parcel-'));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, 'image.bin');
    const bytes = Buffer.from([0, 255, 128, 10, 13, 0]);
    writeFileSync(filePath, bytes);
    const asset: ParcelOutputAsset = { name: 'image.bin', filePath, type: 'bin' };

    const assetsMap = getAssetsMap(new Map([['assets/image.bin', asset]]));
    const uploadedAsset = Object.values(assetsMap)[0];

    expect(Buffer.isBuffer(uploadedAsset.buffer)).toBe(true);
    expect(uploadedAsset.buffer).toEqual(bytes);
    expect(asset.content).toBeUndefined();
  });

  it('fails the build when an emitted file cannot be read', () => {
    const missingPath = path.join(tmpdir(), `missing-${Date.now()}`, 'app.js');
    const asset: ParcelOutputAsset = {
      name: 'app.js',
      filePath: missingPath,
      type: 'js',
    };

    expect(() => getAssetsMap(new Map([['app.js', asset]]))).toThrow(/ENOENT/);
  });

  it('keeps nested paths distinct when output files share a basename', () => {
    const distDir = path.join('/project', 'dist');
    const assets = collectParcelAssets([
      {
        filePath: path.join(distDir, 'assets', 'index.js'),
        target: { distDir },
        type: 'js',
      },
      {
        filePath: path.join(distDir, 'chunks', 'index.js'),
        target: { distDir },
        type: 'js',
      },
    ]);

    expect([...assets.keys()]).toEqual(['assets/index.js', 'chunks/index.js']);
    expect(getParcelAssetPath('/outside/index.js', distDir)).toBe('index.js');
  });

  it('creates independent asset state for successive builds', () => {
    const distDir = path.join('/project', 'dist');
    const firstBuild = collectParcelAssets([
      { filePath: path.join(distDir, 'first.js'), target: { distDir }, type: 'js' },
    ]);
    const secondBuild = collectParcelAssets([
      { filePath: path.join(distDir, 'second.js'), target: { distDir }, type: 'js' },
    ]);

    expect([...firstBuild.keys()]).toEqual(['first.js']);
    expect([...secondBuild.keys()]).toEqual(['second.js']);
  });

  it('keeps client and server target outputs under one collision-free root', () => {
    const distRoot = path.join('/project', 'dist');
    const assets = collectParcelAssets([
      {
        filePath: path.join(distRoot, 'client', 'index.js'),
        target: { distDir: path.join(distRoot, 'client'), name: 'client' },
        type: 'js',
      },
      {
        filePath: path.join(distRoot, 'server', 'index.js'),
        target: { distDir: path.join(distRoot, 'server'), name: 'server' },
        type: 'js',
      },
    ]);

    expect([...assets.keys()]).toEqual(['client/index.js', 'server/index.js']);
  });

  it('keeps a TAP package root unchanged instead of inferring an output prefix', () => {
    const distDir = path.join('/project', 'tap-package');
    const assets = collectParcelAssets(
      [
        {
          filePath: path.join(distDir, 'manifest.tap.json'),
          target: { distDir },
          type: 'json',
        },
        {
          filePath: path.join(distDir, 'targets', 'desktop', 'remoteEntry.mjs'),
          target: { distDir },
          type: 'js',
        },
      ],
      { preserveArtifactPaths: true }
    );

    expect([...assets.keys()]).toEqual([
      'manifest.tap.json',
      'targets/desktop/remoteEntry.mjs',
    ]);
  });

  it('rejects separate Parcel output roots for TAP instead of manufacturing path prefixes', () => {
    expect(() =>
      collectParcelAssets(
        [
          {
            filePath: '/project/dist/desktop/remoteEntry.mjs',
            target: { distDir: '/project/dist/desktop', name: 'desktop' },
            type: 'js',
          },
          {
            filePath: '/project/dist/worker/remoteEntry.mjs',
            target: { distDir: '/project/dist/worker', name: 'worker' },
            type: 'js',
          },
        ],
        { preserveArtifactPaths: true }
      )
    ).toThrow('Parcel tap-app publication requires one package-root distDir');
  });

  it('rejects a TAP artifact emitted outside the configured package root', () => {
    expect(() =>
      collectParcelAssets(
        [
          {
            filePath: '/project/outside/manifest.tap.json',
            target: { distDir: '/project/tap-package' },
            type: 'json',
          },
        ],
        { preserveArtifactPaths: true }
      )
    ).toThrow('Parcel emitted TAP artifact outside its package-root distDir');
  });
});
