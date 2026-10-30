import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import type { NativeEnvRuntimeRoot } from '../runtime/env-runtime-plugin';

/** JSON that is also safe as JS source. */
function jsLiteral(value: unknown): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Writes the MF runtime plugin module the Metro and Re.Pack plugins inject, and returns
 * its absolute path; `undefined` when no dependency resolved and no root manifest is set
 * (nothing to load). The module binds this build's remote → application UID map and root
 * manifest to the env runtime plugin, because Metro MF calls runtime plugins without
 * params. The file name hashes the content, so equal inputs share one file.
 */
export function writeNativeEnvRuntimePlugin(
  outDir: string,
  resolvedDependencies: ReadonlyArray<{ name: string; application_uid: string }> | null,
  root?: NativeEnvRuntimeRoot
): string | undefined {
  const remoteUids = Object.fromEntries(
    (resolvedDependencies ?? []).map(({ name, application_uid }) => [
      name,
      application_uid,
    ])
  );
  if (Object.keys(remoteUids).length === 0 && !root) return undefined;

  // CJS build of src/runtime/env-runtime-plugin.ts (dist/lib → dist/runtime). An absolute
  // path, because under pnpm the app cannot resolve zephyr-native-internal by name.
  const runtimePath = path.join(__dirname, '..', 'runtime', 'env-runtime-plugin.js');
  const rootArgument = root
    ? `, ${jsLiteral({
        name: root.name,
        applicationUid: root.applicationUid,
        manifestUrl: root.manifestUrl,
      })}`
    : '';
  const source = `'use strict';\nvar createNativeEnvRuntimePlugin = require(${JSON.stringify(runtimePath)}).createNativeEnvRuntimePlugin;\nvar REMOTE_UIDS = ${jsLiteral(remoteUids)};\nmodule.exports = function zephyrNativeEnvPlugin() {\n  return createNativeEnvRuntimePlugin(REMOTE_UIDS${rootArgument});\n};\n`;
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
