import type { ZeBuildAsset } from 'zephyr-edge-contract';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';

export function zeBuildAssets({
  filepath,
  content,
}: {
  filepath: string;
  content: string | Buffer;
}): ZeBuildAsset {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;

  // This MUST match the computeSHA256 function in workers!
  const hash = createHash('sha256')
    .update(buffer.length ? buffer : Buffer.from(filepath, 'utf8'))
    .update(Buffer.from(filepath, 'utf8'))
    .digest('hex');

  return {
    path: filepath,
    extname: extname(filepath),
    hash,
    size: buffer.length,
    buffer: buffer,
  };
}
