import { afterEach, describe, expect, it } from '@rstest/core';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractAssetsFromDirectory } from './extract-assets';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('extractAssetsFromDirectory', () => {
  it('retains every opaque file for a TAP package while generic web output stays filtered', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zephyr-cli-tap-'));
    temporaryDirectories.push(directory);
    await Promise.all([
      mkdir(join(directory, 'node_modules', 'locked'), { recursive: true }),
      mkdir(join(directory, '.git'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(directory, 'manifest.tap.json'), '{"package":"example"}'),
      writeFile(join(directory, 'targets.mjs.map'), 'source-map'),
      writeFile(
        join(directory, 'node_modules', 'locked', 'asset.bin'),
        Buffer.from([0, 255])
      ),
      writeFile(join(directory, '.git', 'opaque-lock'), 'opaque'),
      writeFile(join(directory, '.DS_Store'), 'locked'),
    ]);

    const tapPaths = Object.values(
      await extractAssetsFromDirectory(directory, { target: 'tap-app' })
    ).map((asset) => asset.path);
    const webPaths = Object.values(await extractAssetsFromDirectory(directory)).map(
      (asset) => asset.path
    );

    expect(tapPaths).toEqual(
      expect.arrayContaining([
        'manifest.tap.json',
        'targets.mjs.map',
        'node_modules/locked/asset.bin',
        '.git/opaque-lock',
        '.DS_Store',
      ])
    );
    expect(webPaths).toEqual(['manifest.tap.json']);
  });
});
