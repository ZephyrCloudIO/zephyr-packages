import fs from 'node:fs/promises';
import path from 'node:path';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import type { Source } from 'zephyr-edge-contract';

export async function buildAssetMapFromFiles(
  root: string,
  files: string[]
): Promise<Record<string, Source>> {
  const resolvedRoot = path.resolve(root);

  const assetEntries = await Promise.all(
    files.map(async (rel) => {
      const abs = path.resolve(root, rel);

      if (!abs.startsWith(resolvedRoot)) {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: `Invalid file path: ${rel}`,
        });
      }
      const content = await fs.readFile(abs);
      const source: Source = {
        source: () => content,
        size: () => content.length,
        buffer: () => content,
      };
      return [rel, source] as const;
    })
  );

  return Object.fromEntries(assetEntries);
}
