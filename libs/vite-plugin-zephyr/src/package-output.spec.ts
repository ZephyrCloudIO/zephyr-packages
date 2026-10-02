import { afterAll, beforeAll, describe, expect, test } from '@rstest/core';
import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const packageRoot = path.resolve(import.meta.dirname, '..');
const requiredDependencies = [
  'acorn',
  'acorn-walk',
  'magic-string',
  'rollup',
  'vite',
  'zephyr-agent',
];

let tempRoot: string;
let tarballPath: string;

function run(command: string, args: string[], cwd: string) {
  const env = { ...process.env };
  delete env['NODE_PATH'];

  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env,
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} exited with ${String(result.status)}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return result.stdout;
}

async function linkDependency(consumerRoot: string, dependency: string) {
  const source = await realpath(path.join(packageRoot, 'node_modules', dependency));
  const destination = path.join(consumerRoot, 'node_modules', dependency);
  await mkdir(path.dirname(destination), { recursive: true });
  await symlink(source, destination, process.platform === 'win32' ? 'junction' : 'dir');
}

async function createConsumer(name: string, includeFederationPeer = false) {
  const consumerRoot = path.join(tempRoot, name);
  const nodeModules = path.join(consumerRoot, 'node_modules');
  await mkdir(nodeModules, { recursive: true });
  await writeFile(
    path.join(consumerRoot, 'package.json'),
    JSON.stringify({
      name,
      private: true,
      type: 'module',
      dependencies: {
        'vite-plugin-zephyr': JSON.parse(
          await readFile(path.join(packageRoot, 'package.json'), 'utf8')
        ).version,
      },
      intent: { skills: ['vite-plugin-zephyr'] },
    })
  );

  run('tar', ['-xzf', tarballPath, '-C', nodeModules], consumerRoot);
  await rename(
    path.join(nodeModules, 'package'),
    path.join(nodeModules, 'vite-plugin-zephyr')
  );

  for (const dependency of requiredDependencies) {
    await linkDependency(consumerRoot, dependency);
  }
  if (includeFederationPeer) {
    await linkDependency(consumerRoot, '@module-federation/vite');
  }

  return consumerRoot;
}

function runNode(consumerRoot: string, source: string, esm = true) {
  return run(
    process.execPath,
    [...(esm ? ['--input-type=module'] : []), '-e', source],
    consumerRoot
  );
}

async function findFiles(directory: string, extension: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findFiles(entryPath, extension)));
    } else if (entry.name.endsWith(extension)) {
      files.push(entryPath);
    }
  }
  return files;
}

beforeAll(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), 'vite-plugin-zephyr-package-'));
  tarballPath = path.join(tempRoot, 'vite-plugin-zephyr.tgz');
  const pnpmCli = process.env['npm_execpath'];
  if (pnpmCli) {
    run(process.execPath, [pnpmCli, 'pack', '--out', tarballPath], packageRoot);
  } else if (process.platform === 'win32') {
    run(
      process.env['ComSpec'] ?? 'cmd.exe',
      ['/d', '/s', '/c', `pnpm pack --out "${tarballPath}"`],
      packageRoot
    );
  } else {
    run('pnpm', ['pack', '--out', tarballPath], packageRoot);
  }
});

afterAll(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

describe('published optional federation peer', () => {
  test('does not emit a static ESM import for the optional peer', async () => {
    const consumerRoot = await createConsumer('artifact-inspection');
    const packageDirectory = path.join(
      consumerRoot,
      'node_modules',
      'vite-plugin-zephyr'
    );
    const esmFiles = await findFiles(packageDirectory, '.mjs');

    expect(esmFiles.length).toBeGreaterThan(0);
    for (const file of esmFiles) {
      const source = await readFile(file, 'utf8');
      expect(source).not.toMatch(/^\s*import\b[^\n]*["']@module-federation\/vite["']/mu);
    }
  });

  test('imports through ESM and CommonJS without the optional peer', async () => {
    const consumerRoot = await createConsumer('without-federation-peer');

    runNode(
      consumerRoot,
      `
        import { createRequire } from 'node:module';
        const consumerRequire = createRequire(new URL('./package.json', import.meta.url));
        try {
          consumerRequire.resolve('@module-federation/vite');
          throw new Error('optional federation peer unexpectedly resolved');
        } catch (error) {
          if (String(error).includes('unexpectedly resolved')) throw error;
        }
        const plugin = await import('vite-plugin-zephyr');
        if (typeof plugin.withZephyr !== 'function') throw new Error('missing withZephyr');
      `
    );

    runNode(
      consumerRoot,
      `
        const plugin = require('vite-plugin-zephyr');
        if (typeof plugin.withZephyr !== 'function') throw new Error('missing withZephyr');
      `,
      false
    );
  });

  test('reports the missing peer only when federation is requested', async () => {
    const consumerRoot = await createConsumer('missing-federation-feature');
    const assertion = `
      try {
        withZephyr({ mfConfig: { name: 'probe', exposes: {} } });
        throw new Error('expected federation dependency error');
      } catch (error) {
        const message = String(error?.message ?? error);
        if (!message.includes('@module-federation/vite is required when mfConfig is provided')) {
          throw error;
        }
      }
    `;

    runNode(
      consumerRoot,
      `const { withZephyr } = await import('vite-plugin-zephyr'); ${assertion}`
    );
    runNode(
      consumerRoot,
      `const { withZephyr } = require('vite-plugin-zephyr'); ${assertion}`,
      false
    );
  });

  test('loads the real peer when ESM and CommonJS consumers request federation', async () => {
    const consumerRoot = await createConsumer('with-federation-peer', true);
    const assertion = `
      const plugins = withZephyr({ mfConfig: { name: 'probe', exposes: {} } });
      if (!Array.isArray(plugins) || !plugins.some((plugin) => plugin.name === 'with-zephyr')) {
        throw new Error('Zephyr plugins were not created');
      }
    `;

    runNode(
      consumerRoot,
      `const { withZephyr } = await import('vite-plugin-zephyr'); ${assertion}`
    );
    runNode(
      consumerRoot,
      `const { withZephyr } = require('vite-plugin-zephyr'); ${assertion}`,
      false
    );
  });
});

describe('published Intent skill', () => {
  const intentCli = path.resolve(
    packageRoot,
    '../../node_modules/@tanstack/intent/dist/cli.mjs'
  );

  test('discovers and loads the skill from the packed consumer dependency', async () => {
    const consumerRoot = await createConsumer('intent-discovery');
    const discovery = JSON.parse(
      run(process.execPath, [intentCli, 'list', '--json'], consumerRoot)
    );
    const manifest = JSON.parse(
      await readFile(path.join(packageRoot, 'package.json'), 'utf8')
    );

    expect(discovery.warnings).toEqual([]);
    expect(discovery.skills).toEqual([
      expect.objectContaining({
        use: 'vite-plugin-zephyr#zephyr-vite',
        packageVersion: manifest.version,
        packageSource: 'local',
      }),
    ]);

    const skillPath = run(
      process.execPath,
      [intentCli, 'load', 'vite-plugin-zephyr#zephyr-vite', '--path'],
      consumerRoot
    ).trim();
    const skillDirectory = path.dirname(path.resolve(consumerRoot, skillPath));
    expect(skillDirectory).toBe(
      path.join(consumerRoot, 'node_modules/vite-plugin-zephyr/skills/zephyr-vite')
    );
    expect(
      await readFile(path.join(skillDirectory, 'references/build-lifecycle.md'), 'utf8')
    ).toContain('builder.buildApp()');
    expect(
      await readdir(path.join(consumerRoot, 'node_modules/vite-plugin-zephyr/skills'))
    ).toEqual(['zephyr-vite']);

    const packagedSkill = await readFile(path.join(skillDirectory, 'SKILL.md'), 'utf8');
    for (const reference of packagedSkill.matchAll(
      /\[[^\]]+\]\(([^)#]+)(?:#[^)]*)?\)/gu
    )) {
      const destination = reference[1];
      if (/^https?:\/\//u.test(destination)) continue;
      const referencePath = path.resolve(skillDirectory, destination);
      expect(path.relative(skillDirectory, referencePath)).not.toMatch(
        /^\.\.(?:[/\\]|$)/u
      );
      expect(await readFile(referencePath, 'utf8')).not.toBe('');
    }

    const loadedSkill = run(
      process.execPath,
      [intentCli, 'load', 'vite-plugin-zephyr#zephyr-vite'],
      consumerRoot
    );
    expect(loadedSkill).toContain("from 'vite-plugin-zephyr'");
    expect(loadedSkill).toContain('build-lifecycle.md');
  });

  test('does not expose the package skill when the consumer has not selected it', async () => {
    const consumerRoot = await createConsumer('intent-unselected');
    const consumerManifestPath = path.join(consumerRoot, 'package.json');
    const manifest = JSON.parse(await readFile(consumerManifestPath, 'utf8'));
    manifest.intent.skills = [];
    await writeFile(consumerManifestPath, JSON.stringify(manifest));

    const discovery = JSON.parse(
      run(process.execPath, [intentCli, 'list', '--json'], consumerRoot)
    );
    expect(discovery.skills).toEqual([]);
    expect(() =>
      run(
        process.execPath,
        [intentCli, 'load', 'vite-plugin-zephyr#zephyr-vite'],
        consumerRoot
      )
    ).toThrow();
  });

  test('validates examples and propagates errors without replacing the native compiler', () => {
    const workspaceRoot = path.resolve(packageRoot, '../..');
    const nativeVersion = runNode(
      workspaceRoot,
      "console.log(require('typescript').version)",
      false
    ).trim();

    run(
      process.execPath,
      [
        path.join(workspaceRoot, 'scripts/intent.mjs'),
        'validate',
        path.join(packageRoot, 'skills'),
        '--check',
      ],
      workspaceRoot
    );

    expect(() =>
      run(
        process.execPath,
        [path.join(workspaceRoot, 'scripts/intent.mjs'), 'maintainer', 'unknown-action'],
        workspaceRoot
      )
    ).toThrow();

    expect(
      runNode(workspaceRoot, "console.log(require('typescript').version)", false).trim()
    ).toBe(nativeVersion);
    expect(nativeVersion).toMatch(/^7\./u);
  });
});
