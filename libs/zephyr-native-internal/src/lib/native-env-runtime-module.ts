import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Writes the MF runtime plugin module the Metro and Re.Pack plugins inject, and returns
 * its absolute path; `undefined` when no dependency resolved (nothing to load). The
 * module binds this build's remote → application UID map to the env runtime plugin,
 * because Metro MF calls runtime plugins without params. The file name hashes the
 * content, so equal maps share one file.
 */
export function writeNativeEnvRuntimePlugin(
  outDir: string,
  resolvedDependencies: ReadonlyArray<{ name: string; application_uid: string }> | null
): string | undefined {
  const remoteUids = Object.fromEntries(
    (resolvedDependencies ?? []).map(({ name, application_uid }) => [
      name,
      application_uid,
    ])
  );
  if (Object.keys(remoteUids).length === 0) return undefined;

  // CJS build of src/runtime/env-runtime-plugin.ts (dist/lib → dist/runtime). An absolute
  // path, because under pnpm the app cannot resolve zephyr-native-internal by name.
  const runtimePath = path.join(__dirname, '..', 'runtime', 'env-runtime-plugin.js');
  const map = JSON.stringify(remoteUids)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const source = `'use strict';\nvar createNativeEnvRuntimePlugin = require(${JSON.stringify(runtimePath)}).createNativeEnvRuntimePlugin;\nvar REMOTE_UIDS = ${map};\nmodule.exports = function zephyrNativeEnvPlugin() {\n  return createNativeEnvRuntimePlugin(REMOTE_UIDS);\n};\n`;
  const outPath = path.join(
    outDir,
    `env-plugin-${createHash('sha256').update(source).digest('hex').slice(0, 16)}.js`
  );
  if (existsSync(outPath)) return outPath;

  mkdirSync(outDir, { recursive: true });
  const tempPath = `${outPath}.${process.pid}.tmp`;
  writeFileSync(tempPath, source, 'utf8');
  renameSync(tempPath, outPath);
  return outPath;
}
