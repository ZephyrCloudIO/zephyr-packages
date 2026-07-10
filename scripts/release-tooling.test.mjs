import { afterEach, describe, expect, it } from '@rstest/core';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { selectNextPrereleaseVersion } from './next-prerelease-version.mjs';
import { setPackageVersions } from './set-package-version.mjs';

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe('release version tooling', () => {
  it('advances only after every package has the current prerelease', () => {
    const packages = ['one', 'two'];

    expect(selectNextPrereleaseVersion(packages, [{}, {}], 'canary', '0.0.0')).toBe(
      '0.0.0-canary.1'
    );
    expect(
      selectNextPrereleaseVersion(
        packages,
        [{ canary: '0.0.0-canary.4' }, { canary: '0.0.0-canary.4' }],
        'canary',
        '0.0.0'
      )
    ).toBe('0.0.0-canary.5');
  });

  it('reuses a partially published version so a failed publish can resume', () => {
    expect(
      selectNextPrereleaseVersion(
        ['one', 'two', 'three'],
        [{ next: '1.2.3-next.8' }, { next: '1.2.3-next.7' }, { next: '1.1.9-next.20' }],
        'next',
        '1.2.3'
      )
    ).toBe('1.2.3-next.8');
  });

  it('updates all publishable manifests without creating Git commits or tags', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zephyr-release-tooling-'));
    temporaryRoots.push(root);
    for (const [directory, manifest] of [
      ['one', { name: 'one', version: '1.0.0' }],
      ['two', { name: 'two', version: '1.0.0' }],
      ['private', { name: 'private', version: '1.0.0', private: true }],
    ]) {
      const packageRoot = path.join(root, 'libs', directory);
      await mkdir(packageRoot, { recursive: true });
      await writeFile(path.join(packageRoot, 'package.json'), `${JSON.stringify(manifest)}\n`);
    }

    await expect(setPackageVersions(root, '1.2.3-next.4')).resolves.toEqual({
      packageCount: 2,
      updatedCount: 2,
    });

    for (const directory of ['one', 'two']) {
      const manifest = JSON.parse(
        await readFile(path.join(root, 'libs', directory, 'package.json'), 'utf8')
      );
      expect(manifest.version).toBe('1.2.3-next.4');
    }
    const privateManifest = JSON.parse(
      await readFile(path.join(root, 'libs/private/package.json'), 'utf8')
    );
    expect(privateManifest.version).toBe('1.0.0');
  });

  it('rejects invalid versions before modifying a manifest', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zephyr-release-tooling-invalid-'));
    temporaryRoots.push(root);
    const packageRoot = path.join(root, 'libs', 'one');
    await mkdir(packageRoot, { recursive: true });
    const manifestFile = path.join(packageRoot, 'package.json');
    await writeFile(manifestFile, '{"name":"one","version":"1.0.0"}\n');

    await expect(setPackageVersions(root, 'not-semver')).rejects.toThrow('Invalid package version');
    expect(await readFile(manifestFile, 'utf8')).toBe('{"name":"one","version":"1.0.0"}\n');
  });
});
