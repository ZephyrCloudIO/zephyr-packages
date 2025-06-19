import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import type { ZeBuildAsset } from 'zephyr-edge-contract';

export function zeBuildAssets({
  filepath,
  content,
}: {
  filepath: string;
  content: string | Buffer;
}): ZeBuildAsset {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;

  const hash = createHash('sha256')
    .update(buffer)
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
