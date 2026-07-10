import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execCommandSync } from '../../../scripts/run-command.mjs';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = join(packageRoot, '..', '..');
const agentRoot = join(workspaceRoot, 'libs', 'zephyr-agent');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'vite-plugin-zephyr-package-'));
const nodeModules = join(temporaryRoot, 'node_modules');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(executable, args, cwd = temporaryRoot) {
  return execCommandSync(executable, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

try {
  const packed = JSON.parse(
    run(npmExecutable, ['pack', '--dry-run', '--ignore-scripts', '--json'], packageRoot)
  );
  const packedFiles = new Set(packed[0]?.files?.map(({ path }) => path) ?? []);
  for (const requiredFile of [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/lib/internal/mf-vite-etl/runtime_plugin.mjs',
  ]) {
    if (!packedFiles.has(requiredFile)) {
      throw new Error(`Packed vite-plugin-zephyr is missing ${requiredFile}`);
    }
  }
  if ([...packedFiles].some((file) => file.endsWith('.tsbuildinfo'))) {
    throw new Error('Packed vite-plugin-zephyr contains TypeScript build metadata');
  }

  mkdirSync(nodeModules, { recursive: true });
  const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
  symlinkSync(packageRoot, join(nodeModules, 'vite-plugin-zephyr'), symlinkType);
  symlinkSync(agentRoot, join(nodeModules, 'zephyr-agent'), symlinkType);

  writeFileSync(
    join(temporaryRoot, 'require-smoke.cjs'),
    [
      "const assert = require('node:assert/strict');",
      "const plugin = require('vite-plugin-zephyr');",
      "assert.equal(typeof plugin.withZephyr, 'function');",
      "assert.equal(typeof plugin.withZephyrPartial, 'function');",
    ].join('\n')
  );
  writeFileSync(
    join(temporaryRoot, 'import-smoke.mjs'),
    [
      "import assert from 'node:assert/strict';",
      "import { withZephyr } from 'vite-plugin-zephyr';",
      "assert.equal(typeof withZephyr, 'function');",
      "const plugins = withZephyr({ mfConfig: { name: 'host' } });",
      "const federationPlugin = plugins.find(({ name }) => name === 'module-federation-vite');",
      "assert.deepEqual(federationPlugin?._options.runtimePlugins, ['virtual:zephyr-mf-runtime-plugin']);",
      'const plugin = plugins.at(-1);',
      "assert.equal(plugin?.name, 'with-zephyr');",
      "const runtime = await plugin.load('\\0virtual:zephyr-mf-runtime-plugin');",
      'assert.match(runtime, /Zephyr/);',
    ].join('\n')
  );
  writeFileSync(
    join(temporaryRoot, 'types-smoke.mts'),
    [
      "import { withZephyr, type ModuleFederationOptions } from 'vite-plugin-zephyr';",
      "const mfConfig: ModuleFederationOptions = { name: 'host' };",
      'void withZephyr;',
      'void mfConfig;',
    ].join('\n')
  );

  run(process.execPath, ['--no-experimental-require-module', 'require-smoke.cjs']);
  run(process.execPath, ['import-smoke.mjs']);

  const require = createRequire(import.meta.url);
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

  console.log('Packed Vite plugin import, require, types, and runtime asset verified.');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
