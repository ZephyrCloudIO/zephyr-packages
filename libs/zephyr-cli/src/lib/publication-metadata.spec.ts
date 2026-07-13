import { afterEach, describe, expect, it } from '@rstest/core';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadPublicationMetadata,
  parsePublicationMetadata,
} from './publication-metadata';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

const multiContainerSidecar = {
  mfConfigs: [
    {
      name: 'desktop',
      filename: 'targets/desktop/remoteEntry.mjs',
      library: { type: 'module' },
      exposes: { './ui': './src/desktop.ts' },
    },
    {
      name: 'quickjs',
      filename: 'targets/quickjs/remoteEntry.mjs',
      library: { type: 'module' },
      exposes: { './background': './src/quickjs.ts' },
    },
  ],
  federation: [
    {
      name: 'desktop',
      remote: 'targets/desktop/remoteEntry.mjs',
      mf_manifest: 'targets/desktop/mf-manifest.json',
      library_type: 'module',
    },
    {
      name: 'quickjs',
      remote: 'targets/quickjs/remoteEntry.mjs',
      library_type: 'module',
    },
  ],
};

describe('TAP publication metadata sidecars', () => {
  it('retains every SDK-produced container and does not choose a legacy first config', () => {
    const metadata = parsePublicationMetadata(multiContainerSidecar, 'tap-app');

    expect(metadata.mfConfigs).toEqual(multiContainerSidecar.mfConfigs);
    expect(metadata.federation).toEqual(multiContainerSidecar.federation);
    expect(metadata.mfConfig).toBeUndefined();
  });

  it('derives the legacy field only for one unambiguous config', () => {
    const metadata = parsePublicationMetadata(
      {
        mfConfigs: [multiContainerSidecar.mfConfigs[0]],
        federation: [multiContainerSidecar.federation[0]],
      },
      'tap-app'
    );

    expect(metadata.mfConfig).toMatchObject({
      name: 'desktop',
      filename: 'targets/desktop/remoteEntry.mjs',
    });
  });

  it('fails closed when TAP metadata omits one of the typed arrays', () => {
    expect(() =>
      parsePublicationMetadata(
        { mfConfigs: [multiContainerSidecar.mfConfigs[0]] },
        'tap-app'
      )
    ).toThrow('non-empty federation array');
  });

  it('fails closed when a config and build-stat entry disagree', () => {
    expect(() =>
      parsePublicationMetadata(
        {
          ...multiContainerSidecar,
          federation: [
            {
              ...multiContainerSidecar.federation[0],
              remote: 'targets/desktop/not-the-entry.mjs',
            },
            multiContainerSidecar.federation[1],
          ],
        },
        'tap-app'
      )
    ).toThrow('must pair mfConfigs entry');
  });

  it('rejects unsupported top-level metadata fields instead of silently dropping them', () => {
    expect(() =>
      parsePublicationMetadata({ ...multiContainerSidecar, firstConfig: 0 }, 'tap-app')
    ).toThrow('unsupported field');
  });

  it('requires a sidecar for a TAP upload', async () => {
    await expect(
      loadPublicationMetadata({ cwd: process.cwd(), target: 'tap-app' })
    ).rejects.toThrow('requires --metadata');
  });

  it('loads JSON sidecars relative to the CLI working directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zephyr-cli-sidecar-'));
    temporaryDirectories.push(directory);
    const metadataPath = 'publication.json';
    await writeFile(join(directory, metadataPath), JSON.stringify(multiContainerSidecar));

    await expect(
      loadPublicationMetadata({ metadataPath, cwd: directory, target: 'tap-app' })
    ).resolves.toMatchObject({
      mfConfigs: multiContainerSidecar.mfConfigs,
      federation: multiContainerSidecar.federation,
    });
  });

  it('rejects invalid JSON sidecars before an upload can start', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zephyr-cli-sidecar-'));
    temporaryDirectories.push(directory);
    const metadataPath = 'broken.json';
    await writeFile(join(directory, metadataPath), '{not-json');

    await expect(
      loadPublicationMetadata({ metadataPath, cwd: directory, target: 'tap-app' })
    ).rejects.toThrow('could not parse JSON');
  });
});
