import { describe, expect, it } from '@rstest/core';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { zeBuildAssets } from '../transformers/ze-build-assets';
import { writeFileAtomically } from './atomic-file';
import {
  claimPartialAssetMap,
  claimPartialAssetMapBatch,
  commitPartialAssetMapClaim,
  commitPartialAssetMapClaimBatch,
  deserializePartialAssetMaps,
  getPartialAssetMap,
  getLegacyPartialAssetStorePath,
  getPartialAssetStorePath,
  removePartialAssetMap,
  rollbackPartialAssetMapClaim,
  rollbackPartialAssetMapClaimBatch,
  savePartialAssetMap,
  serializePartialAssetMaps,
} from './partial-assets-map';

function assetMap(buffer: Buffer | string): ZeBuildAssetsMap {
  const built = zeBuildAssets({ filepath: 'client/app.js', content: buffer });
  return {
    [built.hash]: {
      ...built,
      buffer,
    },
  };
}

function onlyAsset(assetsMap: ZeBuildAssetsMap | undefined) {
  return assetsMap && Object.values(assetsMap)[0];
}

function onlyEntry(assetsMap: ZeBuildAssetsMap): [string, ZeBuildAsset] {
  const entry = Object.entries(assetsMap)[0];
  if (!entry) throw new Error('Expected one test asset');
  return entry;
}

describe('partial asset map persistence', () => {
  it('keeps the last committed file when an atomic replacement is interrupted', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'zephyr-partial-atomic-'));
    const destination = path.join(directory, 'store.json');
    writeFileSync(destination, 'committed', 'utf8');

    await expect(
      writeFileAtomically(destination, 'replacement', {
        beforeRename: () => {
          throw new Error('simulated process interruption');
        },
      })
    ).rejects.toThrow('simulated process interruption');

    expect(readFileSync(destination, 'utf8')).toBe('committed');
    expect(readdirSync(directory)).toEqual(['store.json']);
  });

  it('round-trips binary and string asset content through JSON serialization', () => {
    const persisted = serializePartialAssetMaps({
      client: assetMap(Buffer.from([0, 255, 1, 128])),
      manifest: assetMap('{"ok":true}'),
    });
    const parsed = JSON.parse(JSON.stringify(persisted));
    const restored = deserializePartialAssetMaps(parsed);

    expect(onlyAsset(restored?.['client'])?.buffer).toEqual(
      Buffer.from([0, 255, 1, 128])
    );
    expect(onlyAsset(restored?.['manifest'])?.buffer).toBe('{"ok":true}');
  });

  it('restores legacy Node Buffer JSON written by earlier releases', () => {
    const [hash, originalAsset] = onlyEntry(assetMap(Buffer.from('ssr')));
    const restored = deserializePartialAssetMaps({
      server: {
        [hash]: {
          ...originalAsset,
          buffer: { type: 'Buffer', data: [115, 115, 114] },
        },
      },
    });

    expect(onlyAsset(restored?.['server'])?.buffer).toEqual(Buffer.from('ssr'));
  });

  it('migrates a legacy node-persist datum before deleting its source', async () => {
    const applicationUid = `partial-legacy-${randomUUID()}`;
    const legacyPath = getLegacyPartialAssetStorePath(applicationUid);
    const persisted = serializePartialAssetMaps({ legacy: assetMap('legacy') });
    try {
      writeFileSync(
        legacyPath,
        JSON.stringify({
          key: `ze_app_partial_asset_map.${applicationUid}`,
          value: persisted,
          ttl: null,
        }),
        'utf8'
      );

      const migrated = await getPartialAssetMap(applicationUid);

      expect(onlyAsset(migrated?.['legacy'])?.buffer).toBe('legacy');
      expect(existsSync(getPartialAssetStorePath(applicationUid))).toBe(true);
      expect(existsSync(legacyPath)).toBe(false);
    } finally {
      await removePartialAssetMap(applicationUid);
    }
  });

  it('fails closed for malformed persisted buffer data', () => {
    const [hash, originalAsset] = onlyEntry(assetMap(Buffer.alloc(0)));
    expect(() =>
      deserializePartialAssetMaps({
        client: {
          [hash]: {
            ...originalAsset,
            buffer: { type: 'Buffer', data: [999] },
          },
        },
      })
    ).toThrow('invalid buffer');
  });

  it('fails closed when persisted bytes do not match the map key and asset hash', () => {
    const [hash, originalAsset] = onlyEntry(assetMap(Buffer.from('trusted')));

    expect(() =>
      deserializePartialAssetMaps({
        client: {
          [hash]: {
            ...originalAsset,
            buffer: { type: 'Buffer', data: [...Buffer.from('tampered')] },
          },
        },
      })
    ).toThrow('content integrity check');
  });

  it('fails closed instead of silently replacing a truncated application store', async () => {
    const applicationUid = `partial-truncated-${randomUUID()}`;
    const scope = { invocationId: 'truncated', generation: 0 };
    try {
      await savePartialAssetMap(applicationUid, 'client', assetMap('committed'), scope);
      writeFileSync(getPartialAssetStorePath(applicationUid), '{"truncated":', 'utf8');

      await expect(getPartialAssetMap(applicationUid, scope)).rejects.toThrow(
        'contains invalid JSON'
      );

      writeFileSync(getPartialAssetStorePath(applicationUid), '{}', 'utf8');
      await expect(getPartialAssetMap(applicationUid, scope)).rejects.toThrow(
        'unsupported schema'
      );
    } finally {
      await removePartialAssetMap(applicationUid);
    }
  });

  it('keeps concurrent invocation scopes isolated', async () => {
    const applicationUid = `partial-scope-${randomUUID()}`;
    const firstScope = { invocationId: 'first', generation: 0 };
    const secondScope = { invocationId: 'second', generation: 0 };
    try {
      await Promise.all([
        savePartialAssetMap(
          applicationUid,
          'vite-environment:client',
          assetMap('first'),
          firstScope
        ),
        savePartialAssetMap(
          applicationUid,
          'vite-environment:client',
          assetMap('second'),
          secondScope
        ),
      ]);

      const [first, second] = await Promise.all([
        claimPartialAssetMap(applicationUid, firstScope),
        claimPartialAssetMap(applicationUid, secondScope),
      ]);
      expect(onlyAsset(first?.partialAssetMaps['vite-environment:client'])?.buffer).toBe(
        'first'
      );
      expect(onlyAsset(second?.partialAssetMaps['vite-environment:client'])?.buffer).toBe(
        'second'
      );
    } finally {
      await removePartialAssetMap(applicationUid);
    }
  });

  it('claims multiple scopes atomically and leaves all scopes untouched on failure', async () => {
    const applicationUid = `partial-batch-${randomUUID()}`;
    const internalScope = { invocationId: 'internal', generation: 0 };
    const externalScope = { invocationId: 'external', generation: 0 };
    const missingScope = { invocationId: 'missing', generation: 0 };
    try {
      await savePartialAssetMap(
        applicationUid,
        'vite-environment:client',
        assetMap('internal'),
        internalScope
      );
      await savePartialAssetMap(
        applicationUid,
        'vite-partial:server',
        assetMap('external'),
        externalScope
      );

      await expect(
        claimPartialAssetMapBatch(applicationUid, [internalScope, missingScope])
      ).resolves.toBeUndefined();

      const [winner, loser] = await Promise.all([
        claimPartialAssetMapBatch(applicationUid, [internalScope, externalScope]),
        claimPartialAssetMapBatch(applicationUid, [internalScope, externalScope]),
      ]);
      const batch = winner ?? loser;
      expect([winner, loser].filter(Boolean)).toHaveLength(1);
      expect(batch?.claims).toHaveLength(2);
      if (!batch) throw new Error('Expected one atomic claim batch');

      await rollbackPartialAssetMapClaimBatch(
        applicationUid,
        batch.claims.map(({ claimId }) => claimId)
      );
      const retry = await claimPartialAssetMapBatch(applicationUid, [
        internalScope,
        externalScope,
      ]);
      expect(retry?.claims).toHaveLength(2);
      if (!retry) throw new Error('Expected retryable atomic claim batch');
      await commitPartialAssetMapClaimBatch(
        applicationUid,
        retry.claims.map(({ claimId }) => claimId)
      );
      await expect(
        getPartialAssetMap(applicationUid, internalScope)
      ).resolves.toBeUndefined();
      await expect(
        getPartialAssetMap(applicationUid, externalScope)
      ).resolves.toBeUndefined();
    } finally {
      await removePartialAssetMap(applicationUid);
    }
  });

  it('commits only claimed revisions and never deletes newer concurrent writes', async () => {
    const applicationUid = `partial-revision-${randomUUID()}`;
    const scope = { invocationId: 'shared-build', generation: 3 };
    try {
      await savePartialAssetMap(applicationUid, 'client', assetMap('old'), scope);
      const oldClaim = await claimPartialAssetMap(applicationUid, scope);
      if (!oldClaim) throw new Error('Expected the old revision to be claimed');

      await savePartialAssetMap(applicationUid, 'client', assetMap('new'), scope);
      await commitPartialAssetMapClaim(applicationUid, oldClaim.claimId);

      const newClaim = await claimPartialAssetMap(applicationUid, scope);
      expect(onlyAsset(newClaim?.partialAssetMaps['client'])?.buffer).toBe('new');
    } finally {
      await removePartialAssetMap(applicationUid);
    }
  });

  it('rolls back by releasing the claim without rewriting its snapshot', async () => {
    const applicationUid = `partial-rollback-${randomUUID()}`;
    const scope = { invocationId: 'retryable-build', generation: 0 };
    try {
      await savePartialAssetMap(applicationUid, 'server', assetMap('retry'), scope);
      const firstClaim = await claimPartialAssetMap(applicationUid, scope);
      if (!firstClaim) throw new Error('Expected the initial claim');
      await expect(claimPartialAssetMap(applicationUid, scope)).resolves.toBeUndefined();

      await rollbackPartialAssetMapClaim(applicationUid, firstClaim.claimId);
      const retryClaim = await claimPartialAssetMap(applicationUid, scope);
      expect(onlyAsset(retryClaim?.partialAssetMaps['server'])?.buffer).toBe('retry');
      expect(await getPartialAssetMap(applicationUid, scope)).toBeDefined();
    } finally {
      await removePartialAssetMap(applicationUid);
    }
  });
});
