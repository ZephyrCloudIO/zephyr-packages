import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

/** JSON that is also safe as JS source. */
export function jsLiteral(value: unknown): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Writes `source` to `<outDir>/<prefix>-<content hash>.js` and returns its absolute path.
 * The name hashes the content, so equal inputs share one file and an existing file is
 * reused as is; the temp-file rename keeps concurrent builds from reading a partial
 * file.
 */
export function writeGeneratedModule(
  outDir: string,
  prefix: string,
  source: string
): string {
  const outPath = path.join(
    outDir,
    `${prefix}-${createHash('sha256').update(source).digest('hex').slice(0, 16)}.js`
  );
  if (existsSync(outPath)) return outPath;

  mkdirSync(outDir, { recursive: true });
  const tempPath = `${outPath}.${process.pid}.tmp`;
  writeFileSync(tempPath, source, 'utf8');
  renameSync(tempPath, outPath);
  return outPath;
}
