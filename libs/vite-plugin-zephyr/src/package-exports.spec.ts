import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('published package exports', () => {
  const packageRoot = resolve(__dirname, '..');
  let fixtureRoot: string;

  beforeEach(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'vite-plugin-zephyr-'));
    const nodeModules = join(fixtureRoot, 'node_modules');
    mkdirSync(nodeModules);
    symlinkSync(
      packageRoot,
      join(nodeModules, 'vite-plugin-zephyr'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  test('supports CommonJS require from outside the package', () => {
    const smokeTest = join(fixtureRoot, 'require.cjs');
    writeFileSync(
      smokeTest,
      `const assert = require('node:assert/strict');
const { withZephyr } = require('vite-plugin-zephyr');
assert.equal(typeof withZephyr, 'function');
`
    );

    execFileSync(process.execPath, ['--no-experimental-require-module', smokeTest], {
      cwd: fixtureRoot,
    });
  });

  test('supports ESM import and package-owned runtime loading from any cwd', () => {
    const smokeTest = join(fixtureRoot, 'import.mjs');
    writeFileSync(
      smokeTest,
      `import assert from 'node:assert/strict';
import { withZephyr } from 'vite-plugin-zephyr';

assert.equal(typeof withZephyr, 'function');
const plugin = withZephyr().at(-1);
const runtime = await plugin.load('\\0virtual:zephyr-mf-runtime-plugin');
assert.match(runtime, /Zephyr/);
`
    );

    execFileSync(process.execPath, [smokeTest], { cwd: fixtureRoot });
  });
});

describe('published declaration compatibility', () => {
  const packageRoots = [
    resolve(__dirname, '..'),
    resolve(__dirname, '../../vite-plugin-tanstack-start-zephyr'),
    resolve(__dirname, '../../vite-plugin-vinext-zephyr'),
    resolve(__dirname, '../../zephyr-astro-integration'),
  ];

  test.each(packageRoots)('%s declares the TypeScript syntax floor', (packageRoot) => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    );

    expect(packageJson.peerDependencies?.typescript).toBe('>=5.3');
    expect(packageJson.peerDependenciesMeta?.typescript?.optional).toBe(true);
  });
});
