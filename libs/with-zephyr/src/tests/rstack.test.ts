import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { rstackConfig } from '../bundlers/rstack.js';
import { parseConfigWithAstGrep } from '../engine/ast-grep.js';
import { applyBundlerOperations, hasZephyrCall } from '../operations.js';
import { findRstackSections } from '../rstack.js';
import type { BundlerConfig } from '../types.js';

interface RuntimeConfig {
  plugins: ({ name: string } | undefined)[];
  mode?: string;
  root?: string;
  helperValue?: unknown;
}

type RuntimeDefinition =
  | RuntimeConfig
  | ((options: { command: string }) => RuntimeConfig | Promise<RuntimeConfig>);

function executeConfiguration(filePath: string, env: Record<string, string> = {}) {
  const root = parseConfigWithAstGrep(filePath);
  const definitions: Partial<Record<'app' | 'lib' | 'doc', RuntimeDefinition>> = {};
  const define = Object.fromEntries(
    ['app', 'lib', 'doc'].map((section) => [
      section,
      (config: RuntimeDefinition) => {
        definitions[section as keyof typeof definitions] = config;
      },
    ])
  );
  let factoryCalls = 0;
  const pluginFactory = (name: string) => () => {
    factoryCalls++;
    return { name };
  };
  const modules: Record<string, Record<string, unknown>> = {
    rstack: { define },
    'node:process': { env },
    'zephyr-rsbuild-plugin': { withZephyr: pluginFactory('zephyr-rsbuild-plugin') },
    'zephyr-rspress-plugin': { withZephyr: pluginFactory('zephyr-rspress-plugin') },
  };
  const values: Record<string, unknown> = {
    pluginReact: () => ({ name: 'react' }),
    process: { env },
  };
  const imports = root.findAll({ rule: { kind: 'import_statement' } });
  for (const statement of imports) {
    const module = modules[statement.field('source')!.text().slice(1, -1)];
    for (const specifier of statement.findAll({ rule: { kind: 'import_specifier' } }))
      values[(specifier.field('alias') ?? specifier.field('name'))!.text()] =
        module[specifier.field('name')!.text()];
    for (const namespace of statement.findAll({ rule: { kind: 'namespace_import' } }))
      values[namespace.namedChildren().at(-1)!.text()] = module;
  }
  const script = root.commitEdits(imports.map((statement) => statement.replace('')));
  new Function(...Object.keys(values), script)(...Object.values(values));
  return { definitions, factoryCalls: () => factoryCalls };
}

async function resolveDefinition(
  definition: RuntimeDefinition | undefined
): Promise<RuntimeConfig> {
  if (!definition) throw new Error('Missing runtime fixture configuration');
  return typeof definition === 'function' ? definition({ command: 'build' }) : definition;
}

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
      for (const section of findRstackSections(filePath)) {
        expect(transform(section).status).toBe('changed');
        expect(hasZephyrCall(filePath, configFor(section)).status).toBe('changed');
      }
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

  it('upgrades existing app registrations without preventing other sections', () => {
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
    expect(hasZephyrCall(filePath, configFor('app')).status).toBe('no-match');
    expect(transform('app').status).toBe('changed');
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
    expect(hasZephyrCall(filePath, configFor('app')).status).toBe('no-match');
    expect(hasZephyrCall(filePath, configFor('lib')).status).toBe('no-match');
    expect(transform('app').status).toBe('changed');
    expect(hasZephyrCall(filePath, configFor('app')).status).toBe('changed');
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
    const { definitions } = executeConfiguration(filePath);
    const app = await resolveDefinition(definitions.app);
    expect(app.mode).toBe('build');
    expect(app.plugins.map((plugin) => plugin?.name)).toEqual([
      'react',
      'zephyr-rsbuild-plugin',
    ]);
    const docConfig = await resolveDefinition(definitions.doc);
    expect(docConfig.root).toBe('docs');
    expect(docConfig.plugins.map((plugin) => plugin?.name)).toEqual([
      'zephyr-rspress-plugin',
    ]);
  });

  it.each([
    "define.app(() => { function withZephyr() { return { name: 'other' }; } return { plugins: [] }; });",
    "{ const withZephyr = () => ({ name: 'other' }); define.app({ plugins: [] }); }",
    'define.app(() => { class withZephyr {} return { plugins: [] }; });',
    "for (const withZephyr of [() => ({ name: 'other' })]) { define.app({ plugins: [] }); }",
  ])('resolves imported plugin bindings at the call site: %s', async (configuration) => {
    fs.writeFileSync(
      filePath,
      `import { define } from 'rstack'; import { withZephyr } from 'zephyr-rsbuild-plugin'; ${configuration}`
    );
    expect(transform('app').status).toBe('changed');
    const execution = executeConfiguration(filePath);
    const app = await resolveDefinition(execution.definitions.app);
    expect(app.plugins.map((plugin) => plugin?.name)).toEqual(['zephyr-rsbuild-plugin']);
    expect(execution.factoryCalls()).toBe(1);
    expect(hasZephyrCall(filePath, configFor('app')).status).toBe('changed');
    const updated = fs.readFileSync(filePath, 'utf8');
    expect(transform('app').status).toBe('no-match');
    expect(fs.readFileSync(filePath, 'utf8')).toBe(updated);
  });

  it('does not treat a call to a shadowing local function as an existing integration', async () => {
    fs.writeFileSync(
      filePath,
      `import { define } from 'rstack'; import { withZephyr } from 'zephyr-rsbuild-plugin'; define.app(() => { function withZephyr() { return { name: 'other' }; } return { plugins: [withZephyr()] }; });`
    );
    expect(hasZephyrCall(filePath, configFor('app')).status).toBe('no-match');
    expect(transform('app').status).toBe('changed');
    const execution = executeConfiguration(filePath);
    expect(
      (await resolveDefinition(execution.definitions.app)).plugins.map(
        (plugin) => plugin?.name
      )
    ).toEqual(['other', 'zephyr-rsbuild-plugin']);
  });

  it.each([
    [
      "const helper = { mode() { return 'production'; } };",
      'helper.mode()',
      'production',
    ],
    [
      "class Helper { mode() { return 'production'; } } const helper = new Helper();",
      'helper.mode()',
      'production',
    ],
    [
      "const helper = { options() { return { label: 'untouched' }; } };",
      'helper.options()',
      { label: 'untouched' },
    ],
    [
      "class Helper { options() { return { label: 'untouched' }; } } const helper = new Helper();",
      'helper.options()',
      { label: 'untouched' },
    ],
  ])('preserves nested method returns: %s', async (helper, expression, expected) => {
    fs.writeFileSync(
      filePath,
      `import { define } from 'rstack'; define.app(() => { ${helper} return { helperValue: ${expression}, plugins: [] }; });`
    );
    expect(transform('app').status).toBe('changed');
    expect(fs.readFileSync(filePath, 'utf8')).toContain(helper);
    const execution = executeConfiguration(filePath);
    const app = await resolveDefinition(execution.definitions.app);
    expect(app.helperValue).toEqual(expected);
    expect(app.plugins.map((plugin) => plugin?.name)).toEqual(['zephyr-rsbuild-plugin']);
    expect(execution.factoryCalls()).toBe(1);
  });

  it.each([
    "[{ name: 'other', setup() { const unused = () => withZephyr(); } }]",
    "[{ name: 'other', setup() { withZephyr(); } }]",
    "[{ name: 'other', unused: withZephyr() }]",
  ])(
    'does not confuse nested callbacks or metadata with plugin registration: %s',
    async (plugins) => {
      fs.writeFileSync(
        filePath,
        `import { define } from 'rstack'; import { withZephyr } from 'zephyr-rsbuild-plugin'; define.app({ plugins: ${plugins} });`
      );
      expect(hasZephyrCall(filePath, configFor('app')).status).toBe('no-match');
      expect(transform('app').status).toBe('changed');
      const execution = executeConfiguration(filePath);
      expect(
        (await resolveDefinition(execution.definitions.app)).plugins.map(
          (plugin) => plugin?.name
        )
      ).toEqual(['other', 'zephyr-rsbuild-plugin']);
      expect(hasZephyrCall(filePath, configFor('app')).status).toBe('changed');
    }
  );

  it.each(['app', 'lib'] as const)(
    'does not invoke the generated %s deployment factory during Rstest',
    async (section) => {
      fs.writeFileSync(
        filePath,
        `import { define } from 'rstack'; define.${section}({ plugins: [pluginReact()] });`
      );
      expect(transform(section).status).toBe('changed');
      const tests = executeConfiguration(filePath, { RSTEST: 'true' });
      const testConfig = await resolveDefinition(tests.definitions[section]);
      expect(testConfig.plugins.map((plugin) => plugin?.name)).toEqual(['react']);
      expect(tests.factoryCalls()).toBe(0);
      const build = executeConfiguration(filePath);
      expect(
        (await resolveDefinition(build.definitions[section])).plugins.map(
          (plugin) => plugin?.name
        )
      ).toEqual(['react', 'zephyr-rsbuild-plugin']);
      expect(build.factoryCalls()).toBe(1);
    }
  );

  it.each(['app', 'lib'] as const)(
    'guards existing %s registrations without losing options or other plugins',
    async (section) => {
      fs.writeFileSync(
        filePath,
        `import { define } from 'rstack'; import { withZephyr } from 'zephyr-rsbuild-plugin'; define.${section}({ plugins: [pluginReact(), ...(enabled ? [withZephyr({ target: 'web' })] : [])] });`
      );
      fs.writeFileSync(
        filePath,
        `const enabled = true;\n${fs.readFileSync(filePath, 'utf8')}`
      );
      expect(transform(section).status).toBe('changed');
      expect(fs.readFileSync(filePath, 'utf8')).toContain(
        "withZephyr({ target: 'web' })"
      );
      const tests = executeConfiguration(filePath, { RSTEST: 'true' });
      expect(
        (await resolveDefinition(tests.definitions[section])).plugins
          .filter(Boolean)
          .map((plugin) => plugin?.name)
      ).toEqual(['react']);
      expect(tests.factoryCalls()).toBe(0);
      expect(transform(section).status).toBe('no-match');
    }
  );

  it.each([
    ['app', 'process.env.RSTEST'],
    ['app', "process.env['RSTEST']"],
    ['lib', 'process.env.RSTEST'],
    ['lib', "process.env['RSTEST']"],
    ['app', 'process . env . RSTEST'],
  ] as const)(
    'preserves an existing %s global test guard: %s',
    async (section, guard) => {
      const original = `import { define } from 'rstack'; import { withZephyr } from 'zephyr-rsbuild-plugin'; define.${section}({ plugins: [pluginReact(), ...(${guard} ? [] : [withZephyr({ target: 'web' })])] });`;
      fs.writeFileSync(filePath, original);
      expect(hasZephyrCall(filePath, configFor(section)).status).toBe('changed');
      expect(transform(section, true).status).toBe('no-match');
      expect(transform(section).status).toBe('no-match');
      expect(fs.readFileSync(filePath, 'utf8')).toBe(original);
      const tests = executeConfiguration(filePath, { RSTEST: 'true' });
      expect(
        (await resolveDefinition(tests.definitions[section])).plugins.map(
          (plugin) => plugin?.name
        )
      ).toEqual(['react']);
      expect(tests.factoryCalls()).toBe(0);
      const build = executeConfiguration(filePath);
      expect(
        (await resolveDefinition(build.definitions[section])).plugins.map(
          (plugin) => plugin?.name
        )
      ).toEqual(['react', 'zephyr-rsbuild-plugin']);
      expect(build.factoryCalls()).toBe(1);
    }
  );

  it.each([
    'define.app(() => { const process = { env: {} }; return { plugins: [pluginReact(), ...(process.env.RSTEST ? [] : [withZephyr()])] }; });',
    '{ const process = { env: {} }; define.app({ plugins: [pluginReact(), ...(process.env.RSTEST ? [] : [withZephyr()])] }); }',
    'define.app(({ process = { env: {} } }) => ({ plugins: [pluginReact(), ...(process.env.RSTEST ? [] : [withZephyr()])] }));',
    '{ const process = { env: {} }; define.app({ plugins: [pluginReact(), ...(process . env . RSTEST ? [] : [withZephyr()])] }); }',
  ])('does not trust a locally shadowed process guard: %s', async (configuration) => {
    fs.writeFileSync(
      filePath,
      `import { define } from 'rstack'; import { withZephyr } from 'zephyr-rsbuild-plugin'; ${configuration}`
    );
    expect(hasZephyrCall(filePath, configFor('app')).status).toBe('no-match');
    expect(transform('app').status).toBe('changed');
    const tests = executeConfiguration(filePath, { RSTEST: 'true' });
    expect(
      (await resolveDefinition(tests.definitions.app)).plugins
        .filter(Boolean)
        .map((plugin) => plugin?.name)
    ).toEqual(['react']);
    expect(tests.factoryCalls()).toBe(0);
    expect(transform('app').status).toBe('no-match');
  });

  it.each([
    "import { env as process } from 'node:process';",
    "import * as process from 'rstack';",
    "import process from 'unrelated-process';",
  ])('does not trust an imported binding named process: %s', (importStatement) => {
    fs.writeFileSync(
      filePath,
      `import { define } from 'rstack'; import { withZephyr } from 'zephyr-rsbuild-plugin'; ${importStatement} define.app({ plugins: [...(process.env.RSTEST ? [] : [withZephyr()])] });`
    );
    expect(hasZephyrCall(filePath, configFor('app')).status).toBe('no-match');
    expect(transform('app').status).toBe('changed');
    expect(fs.readFileSync(filePath, 'utf8')).toMatch(
      /(?:zephyrEnv|process)\['RSTEST'\] \? undefined : withZephyr\(\)/
    );
    expect(transform('app').status).toBe('no-match');
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
