import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { rstackConfig } from '../bundlers/rstack.js';
import { parseConfigWithAstGrep } from '../engine/ast-grep.js';
import { applyBundlerOperations, hasZephyrCall } from '../operations.js';
import { findRstackSections } from '../rstack.js';
import type { BundlerConfig } from '../types.js';

describe('Rstack configuration', () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zephyr-rstack-test-'));
    filePath = path.join(tempDir, 'rstack.config.ts');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function configFor(
    rstackSection: NonNullable<BundlerConfig['rstackSection']>
  ): BundlerConfig {
    return {
      ...rstackConfig,
      rstackSection,
      plugin: rstackSection === 'doc' ? 'zephyr-rspress-plugin' : 'zephyr-rsbuild-plugin',
    };
  }

  function transform(
    rstackSection: NonNullable<BundlerConfig['rstackSection']>,
    dryRun = false
  ) {
    return applyBundlerOperations({ filePath, config: configFor(rstackSection), dryRun });
  }

  it.each(['ts', 'js', 'mts', 'mjs'])(
    'recognizes the %s configuration format',
    (extension) => {
      filePath = path.join(tempDir, `rstack.config.${extension}`);
      fs.writeFileSync(
        filePath,
        "import { define } from 'rstack'; define.app({}); define.doc({}); define.lib({}); define.test({ plugins: [] });"
      );
      expect(findRstackSections(filePath)).toEqual(['app', 'lib', 'doc']);
    }
  );

  it('chooses the plugin independently for every build section', () => {
    fs.writeFileSync(
      filePath,
      `
      import { define } from 'rstack';
      define.app({ plugins: [pluginReact()] });
      define.lib({ format: 'esm' });
      define.doc({ root: 'docs', builderConfig: { plugins: [pluginSass()] } });
      define.test({ plugins: [testPlugin()] });
      define.lint(({ js }) => [js.configs.recommended]);
    `
    );
    for (const section of findRstackSections(filePath)) {
      expect(transform(section)).toEqual({ status: 'changed' });
      expect(
        parseConfigWithAstGrep(filePath)
          .find({ rule: { kind: 'ERROR' } })
          ?.text()
      ).toBeUndefined();
    }
    const output = fs.readFileSync(filePath, 'utf8');
    expect(output.match(/from 'zephyr-rsbuild-plugin'/g)).toHaveLength(1);
    expect(output.match(/from 'zephyr-rspress-plugin'/g)).toHaveLength(1);
    expect(output.match(/withZephyrRsbuild\(\)/g)).toHaveLength(2);
    expect(output.match(/withZephyrRspress\(\)/g)).toHaveLength(1);
    expect(output).toContain('builderConfig: { plugins: [pluginSass()] }');
    expect(output).toContain('define.test({ plugins: [testPlugin()] });');
    expect(output).toContain('define.lint(({ js }) => [js.configs.recommended]);');
    expect(parseConfigWithAstGrep(filePath).find({ rule: { kind: 'ERROR' } })).toBeNull();
  });

  it.each([
    'define.app(() => ({ source: { entry: { index: "./src/index.ts" } } }));',
    'define.app(async ({ command }) => { const nested = () => ({ plugins: [] }); return { plugins: [pluginReact()], mode: command }; });',
    'define.app(function ({ command }) { return { plugins: [], mode: command }; });',
    'define.app({ plugins: [pluginReact(),] } satisfies RsbuildConfig);',
    'define.app({ plugins } as RsbuildConfig);',
    'define.app({ plugins: sharedPlugins });',
    'define.app(() => { if (production) return { plugins: [] }; return { plugins: [] }; });',
  ])('preserves and transforms inline configuration %s', (configuration) => {
    fs.writeFileSync(filePath, `import { define } from 'rstack';\n${configuration}`);
    expect(transform('app').status).toBe('changed');
    const output = fs.readFileSync(filePath, 'utf8');
    expect(output).toContain('withZephyrRsbuild()');
    expect(parseConfigWithAstGrep(filePath).find({ rule: { kind: 'ERROR' } })).toBeNull();
    expect(hasZephyrCall(filePath, configFor('app')).status).toBe('changed');
    if (configuration.includes('const nested'))
      expect(output).toContain('const nested = () => ({ plugins: [] });');
  });

  it.each([
    ["import { define as configure } from 'rstack';", 'configure.app({});'],
    ["import * as rstack from 'rstack';", 'rstack.define.app({});'],
  ])('recognizes imported define aliases', (importStatement, configuration) => {
    fs.writeFileSync(filePath, `${importStatement}\n${configuration}`);
    expect(findRstackSections(filePath)).toEqual(['app']);
    expect(transform('app').status).toBe('changed');
  });

  it('does not treat unrelated define APIs as Rstack configuration', () => {
    fs.writeFileSync(
      filePath,
      "import { define } from 'other-package'; define.app({ plugins: [] });"
    );
    expect(findRstackSections(filePath)).toEqual([]);
  });

  it('does not rewrite a shadowed define API inside a helper function', () => {
    fs.writeFileSync(
      filePath,
      "import { define } from 'rstack'; function helper(define) { define.app({ plugins: [] }); }"
    );
    expect(findRstackSections(filePath)).toEqual([]);
  });

  it('only skips the section that already uses the correct plugin', () => {
    fs.writeFileSync(
      filePath,
      `
      import { define } from 'rstack';
      import { withZephyr as deployApp } from 'zephyr-rsbuild-plugin';
      define.app({ plugins: [deployApp({ target: 'web' })] });
      define.lib({ plugins: [] });
      define.doc({ plugins: [] });
    `
    );
    expect(hasZephyrCall(filePath, configFor('app')).status).toBe('changed');
    expect(hasZephyrCall(filePath, configFor('lib')).status).toBe('no-match');
    expect(hasZephyrCall(filePath, configFor('doc')).status).toBe('no-match');
    expect(transform('lib').status).toBe('changed');
    expect(transform('doc').status).toBe('changed');
    const output = fs.readFileSync(filePath, 'utf8');
    expect(output.match(/from 'zephyr-rsbuild-plugin'/g)).toHaveLength(1);
    expect(output.match(/deployApp\(/g)).toHaveLength(2);
  });

  it('is idempotent when an existing plugin uses an import alias and options', () => {
    fs.writeFileSync(
      filePath,
      "import { define } from 'rstack'; import { withZephyr as deployDocs } from 'zephyr-rspress-plugin'; define.doc({ plugins: [deployDocs({ target: 'web' })] });"
    );
    const original = fs.readFileSync(filePath, 'utf8');
    expect(hasZephyrCall(filePath, configFor('doc')).status).toBe('changed');
    expect(transform('doc').status).toBe('no-match');
    expect(fs.readFileSync(filePath, 'utf8')).toBe(original);
  });

  it('does not collide with an existing local binding', () => {
    fs.writeFileSync(
      filePath,
      "import { define } from 'rstack'; const withZephyrRsbuild = pluginReact(); define.app({ plugins: [withZephyrRsbuild] });"
    );
    expect(transform('app').status).toBe('changed');
    const output = fs.readFileSync(filePath, 'utf8');
    expect(output).toContain('withZephyr as withZephyrRsbuild2');
    expect(output).toContain('withZephyrRsbuild2()');
  });

  it.each(['withZephyr', '{ withZephyr }'])(
    'does not reuse an imported plugin binding shadowed by %s',
    (parameter) => {
      fs.writeFileSync(
        filePath,
        `import { define } from 'rstack'; import { withZephyr } from 'zephyr-rsbuild-plugin'; define.app((${parameter}) => ({ plugins: [] }));`
      );
      expect(transform('app').status).toBe('changed');
      expect(fs.readFileSync(filePath, 'utf8')).toContain('withZephyrRsbuild()');
    }
  );

  it('recognizes a dynamically imported Zephyr plugin in its own factory', () => {
    fs.writeFileSync(
      filePath,
      `
      import { define } from 'rstack';
      define.app(async () => {
        const { withZephyr: deployApp } = await import('zephyr-rsbuild-plugin');
        return { plugins: [deployApp({ target: 'web' })] };
      });
      define.lib({ plugins: [] });
    `
    );
    expect(hasZephyrCall(filePath, configFor('app')).status).toBe('changed');
    expect(hasZephyrCall(filePath, configFor('lib')).status).toBe('no-match');
    expect(transform('app').status).toBe('no-match');
    expect(transform('lib').status).toBe('changed');
  });

  it('executes the transformed factories with their original arguments and plugin order', async () => {
    fs.writeFileSync(
      filePath,
      `
      import { define } from 'rstack';
      define.app(async ({ command }) => ({ mode: command, plugins: [pluginReact()] }));
      define.doc({ root: 'docs', plugins: [] });
    `
    );
    expect(transform('app').status).toBe('changed');
    expect(transform('doc').status).toBe('changed');
    const root = parseConfigWithAstGrep(filePath);
    const script = root.commitEdits(
      root
        .findAll({ rule: { kind: 'import_statement' } })
        .map((statement) => statement.replace(''))
    );
    let appConfig: (options: {
      command: string;
    }) => Promise<{ mode: string; plugins: { name: string }[] }>;
    let docConfig: { root: string; plugins: { name: string }[] };
    new Function(
      'define',
      'withZephyrRsbuild',
      'withZephyrRspress',
      'pluginReact',
      script
    )(
      {
        app: (config: typeof appConfig) => {
          appConfig = config;
        },
        doc: (config: typeof docConfig) => {
          docConfig = config;
        },
      },
      () => ({ name: 'zephyr-rsbuild-plugin' }),
      () => ({ name: 'zephyr-rspress-plugin' }),
      () => ({ name: 'react' })
    );
    const app = await appConfig!({ command: 'build' });
    expect(app.mode).toBe('build');
    expect(app.plugins.map((plugin) => plugin.name)).toEqual([
      'react',
      'zephyr-rsbuild-plugin',
    ]);
    expect(docConfig!.root).toBe('docs');
    expect(docConfig!.plugins.map((plugin) => plugin.name)).toEqual([
      'zephyr-rspress-plugin',
    ]);
  });

  it.each([
    'define.app(importedConfiguration);',
    'define.app(() => importedConfiguration);',
    'define.app({ ...sharedConfiguration });',
    'define.app({ plugins: [], ...sharedConfiguration });',
  ])('reports unsupported configuration without modifying it: %s', (configuration) => {
    fs.writeFileSync(filePath, `import { define } from 'rstack'; ${configuration}`);
    const original = fs.readFileSync(filePath, 'utf8');
    expect(transform('app').status).toBe('error');
    expect(fs.readFileSync(filePath, 'utf8')).toBe(original);
  });

  it('does not modify files during a dry run', () => {
    fs.writeFileSync(
      filePath,
      "import { define } from 'rstack'; define.app({ plugins: [] }); define.doc({});"
    );
    const original = fs.readFileSync(filePath, 'utf8');
    expect(transform('app', true).status).toBe('changed');
    expect(transform('doc', true).status).toBe('changed');
    expect(fs.readFileSync(filePath, 'utf8')).toBe(original);
  });
});
