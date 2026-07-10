import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'zephyr-native-cache-package-'));
const applicationRoot = join(temporaryRoot, 'consumer');
const installedPackage = join(applicationRoot, 'node_modules', 'zephyr-native-cache');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const require = createRequire(import.meta.url);

function run(executable, args, cwd = applicationRoot) {
  return execFileSync(executable, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function linkConsumerDependency(packageName) {
  const resolvedEntry = require.resolve(packageName, {
    paths: [packageRoot],
  });
  let sourceRoot = dirname(realpathSync(resolvedEntry));
  while (!existsSync(join(sourceRoot, 'package.json'))) {
    const parent = dirname(sourceRoot);
    if (parent === sourceRoot) {
      throw new Error(`Could not locate package root for ${packageName}`);
    }
    sourceRoot = parent;
  }
  const target = join(applicationRoot, 'node_modules', packageName);
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(sourceRoot, target, 'junction');
}

function writeReactNativeStub() {
  const stubRoot = join(applicationRoot, 'node_modules', 'react-native');
  mkdirSync(stubRoot, { recursive: true });
  writeFileSync(
    join(stubRoot, 'package.json'),
    JSON.stringify({
      name: 'react-native',
      exports: {
        '.': { import: './index.mjs', require: './index.cjs' },
      },
    })
  );
  writeFileSync(join(stubRoot, 'index.mjs'), "export const Platform = { OS: 'ios' };\n");
  writeFileSync(join(stubRoot, 'index.cjs'), "exports.Platform = { OS: 'ios' };\n");
}

try {
  mkdirSync(installedPackage, { recursive: true });
  const packed = JSON.parse(
    run(
      npmExecutable,
      ['pack', '--ignore-scripts', '--json', '--pack-destination', temporaryRoot],
      packageRoot
    )
  );
  const tarballName = packed[0]?.filename;
  if (typeof tarballName !== 'string' || tarballName.length === 0) {
    throw new Error('npm pack did not report a tarball filename');
  }
  run(
    'tar',
    ['-xzf', join(temporaryRoot, tarballName), '-C', installedPackage, '--strip-components=1'],
    packageRoot
  );

  const packageJson = JSON.parse(readFileSync(join(installedPackage, 'package.json'), 'utf8'));
  const runtimeExport = packageJson.exports?.['./runtime-plugin'];
  const importTarget =
    typeof runtimeExport?.import === 'string'
      ? runtimeExport.import
      : runtimeExport?.import?.default;
  const requireTarget =
    typeof runtimeExport?.require === 'string'
      ? runtimeExport.require
      : runtimeExport?.require?.default;
  if (
    importTarget !== './lib/module/runtime-plugin.js' ||
    requireTarget !== './lib/commonjs/runtime-plugin.js' ||
    runtimeExport?.types !== './lib/typescript/runtime-plugin.d.ts'
  ) {
    throw new Error('Packed runtime-plugin exports do not select ESM and CommonJS');
  }

  for (const packageName of ['mitt', 'react', 'zephyr-edge-contract']) {
    linkConsumerDependency(packageName);
  }
  writeReactNativeStub();

  writeFileSync(
    join(applicationRoot, 'import-smoke.mjs'),
    [
      "const resolved = import.meta.resolve('zephyr-native-cache');",
      "if (!resolved.endsWith('/lib/module/index.js')) throw new Error(resolved);",
      "const runtime = await import('zephyr-native-cache/runtime-plugin');",
      "if (typeof runtime.default !== 'function') throw new Error('missing ESM default');",
    ].join('\n')
  );
  writeFileSync(
    join(applicationRoot, 'require-smoke.cjs'),
    [
      "const resolved = require.resolve('zephyr-native-cache');",
      "if (!resolved.replaceAll('\\\\', '/').endsWith('/lib/commonjs/index.js')) throw new Error(resolved);",
      "const runtime = require('zephyr-native-cache/runtime-plugin');",
      "if (typeof runtime.default !== 'function') throw new Error('missing CJS default');",
    ].join('\n')
  );
  writeFileSync(
    join(applicationRoot, 'types-smoke.mts'),
    [
      "import runtimePlugin from 'zephyr-native-cache/runtime-plugin';",
      "import type { ZephyrNativeCacheApi } from 'zephyr-native-cache';",
      'const api: ZephyrNativeCacheApi | undefined = undefined;',
      'void api;',
      'void runtimePlugin;',
    ].join('\n')
  );

  run(process.execPath, ['import-smoke.mjs']);
  run(process.execPath, ['require-smoke.cjs']);

  run(process.execPath, [
    require.resolve('typescript/bin/tsc'),
    '--noEmit',
    '--skipLibCheck',
    '--strict',
    '--target',
    'ES2022',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    'types-smoke.mts',
  ]);

  console.log('Packed package import, require, and type resolution verified.');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
