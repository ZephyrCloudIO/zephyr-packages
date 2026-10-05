import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { getResolvedPackageDirectory } from '../package-manager.js';

describe('Rstack inherited test compilation', () => {
  let tempDir: string;
  let packageRoot: string;
  let rstackDirectory: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zephyr-rstack-inheritance-'));
    packageRoot = fs.existsSync(path.join(process.cwd(), 'libs/with-zephyr/package.json'))
      ? path.join(process.cwd(), 'libs/with-zephyr')
      : process.cwd();
    const resolved = getResolvedPackageDirectory('rstack', packageRoot);
    if (!resolved) throw new Error('The pinned Rstack test dependency is unavailable');
    rstackDirectory = resolved;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeFixture(section: 'app' | 'lib', inlineProjects = false, unsafe = false) {
    const traceFile = path.join(tempDir, 'compiler-trace.log');
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.mkdirSync(path.join(tempDir, 'node_modules', '@rstest'), { recursive: true });
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(
      rstackDirectory,
      path.join(tempDir, 'node_modules', 'rstack'),
      linkType
    );
    const rstackRequire = createRequire(path.join(rstackDirectory, 'package.json'));
    const rstestDirectory = path.dirname(
      path.dirname(rstackRequire.resolve('@rstest/core'))
    );
    fs.symlinkSync(
      rstestDirectory,
      path.join(tempDir, 'node_modules', '@rstest', 'core'),
      linkType
    );
    const pluginDirectory = path.join(tempDir, 'node_modules', 'zephyr-rsbuild-plugin');
    fs.mkdirSync(pluginDirectory);
    fs.writeFileSync(
      path.join(pluginDirectory, 'package.json'),
      JSON.stringify({
        name: 'zephyr-rsbuild-plugin',
        version: '1.5.0',
        type: 'module',
        exports: './index.mjs',
      })
    );
    fs.writeFileSync(
      path.join(pluginDirectory, 'index.mjs'),
      `
      import fs from 'node:fs';
      export function withZephyr() {
        fs.appendFileSync(${JSON.stringify(traceFile)}, 'zephyr-factory\\n');
        return {
          name: 'zephyr-rsbuild-plugin',
          setup(api) {
            api.onBeforeCreateCompiler({ order: 'post', handler() {
              fs.appendFileSync(${JSON.stringify(traceFile)}, 'zephyr-initialization\\n');
              throw new Error('ZEPHYR_INITIALIZATION_REACHED');
            } });
          },
        };
      }
    `
    );
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'rstack-inheritance-fixture',
        version: '1.0.0',
        type: 'module',
        devDependencies: { 'zephyr-rsbuild-plugin': '1.5.0' },
      })
    );
    fs.writeFileSync(
      path.join(tempDir, 'src', 'alias.mjs'),
      "export default 'alias-kept';"
    );
    fs.writeFileSync(
      path.join(tempDir, 'src', 'index.mjs'),
      "export const value = 'build-entry';"
    );
    fs.writeFileSync(
      path.join(tempDir, 'fixture.test.mjs'),
      `
      import { it, expect } from '@rstest/core';
      import alias from 'inherited-alias';
      it('ordinary inherited test', () => {
        expect(alias).toBe('alias-kept');
        expect(FROM_CONFIG).toBe('config-kept');
        expect(FROM_PLUGIN).toBe('plugin-kept');
      });
    `
    );
    fs.writeFileSync(
      path.join(tempDir, 'rstack.config.mjs'),
      `
      import { define } from 'rstack';
      import fs from 'node:fs';
      ${unsafe ? "import { withZephyr } from 'zephyr-rsbuild-plugin';" : ''}
      const inheritedPlugin = {
        name: 'inherited-plugin',
        setup(api) {
          fs.appendFileSync(${JSON.stringify(traceFile)}, 'inherited-plugin\\n');
          api.modifyRsbuildConfig((config) => {
            config.source ??= {};
            config.source.define = { ...config.source.define, FROM_PLUGIN: JSON.stringify('plugin-kept') };
            return config;
          });
        },
      };
      define.${section}({
        source: { entry: { index: './src/index.mjs' }, define: { FROM_CONFIG: JSON.stringify('config-kept') } },
        resolve: { alias: { 'inherited-alias': ${JSON.stringify(path.join(tempDir, 'src', 'alias.mjs'))} } },
        plugins: [inheritedPlugin${unsafe ? ', withZephyr()' : ''}],
        ${section === 'lib' ? "lib: [{ format: 'esm' }]," : ''}
      });
      define.test({
        testEnvironment: 'node', include: ['fixture.test.mjs'],
        ${inlineProjects ? "projects: [{ name: 'first', testEnvironment: 'node', include: ['fixture.test.mjs'] }, { name: 'second', testEnvironment: 'node', include: ['fixture.test.mjs'] }]," : ''}
      });
    `
    );
    return traceFile;
  }

  function runCli(args: string[], allowFailure = false, env: NodeJS.ProcessEnv = {}) {
    try {
      return execFileSync(
        process.execPath,
        [path.join(rstackDirectory, 'bin', 'rs.js'), ...args],
        {
          cwd: tempDir,
          encoding: 'utf8',
          timeout: 25_000,
          env: {
            ...process.env,
            CI: 'true',
            NO_COLOR: '1',
            FORCE_COLOR: undefined,
            RSTEST: '',
            ...env,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
    } catch (error) {
      if (!allowFailure) throw error;
      const result = error as { stdout?: string; stderr?: string };
      return `${result.stdout ?? ''}${result.stderr ?? ''}`;
    }
  }

  it.each([
    ['app', false],
    ['lib', false],
    ['app', true],
    ['lib', true],
  ] as const)(
    'keeps %s inheritance and inline projects=%s free of deployment hooks',
    (section, inlineProjects) => {
      const traceFile = writeFixture(section, inlineProjects);
      execFileSync(
        process.execPath,
        [
          path.join(packageRoot, 'dist', 'index.js'),
          tempDir,
          '--bundlers',
          'rstack',
          '--no-attribution',
        ],
        {
          encoding: 'utf8',
          env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: undefined },
        }
      );
      const output = runCli(['test', 'run', '--reporter', 'verbose']);
      expect(output).toContain('ordinary inherited test');
      const trace = fs.readFileSync(traceFile, 'utf8');
      expect(trace).toContain('inherited-plugin');
      expect(trace).not.toContain('zephyr-factory');
      expect(trace).not.toContain('zephyr-initialization');
    }
  );

  it('rejects the original unsafe setup before any deployment can happen', () => {
    const traceFile = writeFixture('app', false, true);
    expect(runCli(['test', 'run'], true)).toContain('ZEPHYR_INITIALIZATION_REACHED');
    expect(fs.readFileSync(traceFile, 'utf8')).toContain('zephyr-initialization');
  });

  it('still reaches the deployment compiler hook for an application build', () => {
    const traceFile = writeFixture('app');
    execFileSync(
      process.execPath,
      [
        path.join(packageRoot, 'dist', 'index.js'),
        tempDir,
        '--bundlers',
        'rstack',
        '--no-attribution',
      ],
      { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: undefined } }
    );
    expect(runCli(['build'], true, { NODE_ENV: 'production' })).toContain(
      'ZEPHYR_INITIALIZATION_REACHED'
    );
    expect(fs.readFileSync(traceFile, 'utf8')).toContain('zephyr-initialization');
  });
});
