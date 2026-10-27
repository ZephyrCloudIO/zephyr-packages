import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Writes an MF runtime plugin module that records `remoteUids` in
 * `globalThis.__ZEPHYR__.runtime.remoteApplicationUids` when Module Federation
 * instantiates it, and returns its absolute path. Names already recorded keep their UID
 * (the consuming app's own seed runs first). The file name hashes the content, so equal
 * maps share one file.
 */
export function writeNativeRemoteUidsPlugin(
  outDir: string,
  remoteUids: Readonly<Record<string, string>>
): string {
  const map = JSON.stringify(remoteUids)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const source = `'use strict';\nvar REMOTE_UIDS = ${map};\nmodule.exports = function zephyrRemoteUidsPlugin() {\n  var zephyr = globalThis.__ZEPHYR__;\n  if (typeof zephyr !== 'object' || zephyr === null) zephyr = globalThis.__ZEPHYR__ = { version: 1, runtime: {} };\n  if (typeof zephyr.runtime !== 'object' || zephyr.runtime === null) zephyr.runtime = {};\n  var uids = zephyr.runtime.remoteApplicationUids;\n  if (typeof uids !== 'object' || uids === null) uids = zephyr.runtime.remoteApplicationUids = {};\n  for (var name in REMOTE_UIDS) {\n    if (!Object.prototype.hasOwnProperty.call(uids, name)) uids[name] = REMOTE_UIDS[name];\n  }\n  return { name: 'zephyr-remote-uids' };\n};\n`;
  const outPath = path.join(
    outDir,
    `remote-uids-${createHash('sha256').update(source).digest('hex').slice(0, 16)}.js`
  );
  if (existsSync(outPath)) return outPath;

  mkdirSync(outDir, { recursive: true });
  const tempPath = `${outPath}.${process.pid}.tmp`;
  writeFileSync(tempPath, source, 'utf8');
  renameSync(tempPath, outPath);
  return outPath;
}
