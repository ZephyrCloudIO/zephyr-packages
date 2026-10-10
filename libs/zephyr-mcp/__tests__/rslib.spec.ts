import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRslib } from '@rslib/core';
import { afterAll, beforeAll, describe, expect, it } from '@rstest/core';
import { checkArtifact, runtimeModuleProblems } from '../src/checks';
import {
  parseCatalogManifest,
  parseProviderDescriptor,
  sha256Hex,
  type CatalogManifest,
} from '../src/manifest';
import { defineMcpConfig, type McpConfigOptions } from '../src/rslib';
import { callProviderWorker, PROVIDER_SYMBOL, type ProviderFetcher } from '../src/worker';
import type { SkillsProvider } from '../src/types';
import { materializeFixture } from './helpers/fixtures';

const fixtures = path.resolve(import.meta.dirname, 'fixtures');
const packageVersion = (
  JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8')
  ) as { version: string }
).version;
const srcIndex = path.resolve(import.meta.dirname, '../src/index');
// A copy of fixtures/tools-repo with its binary fixtures decoded (contract
// 13.5), beside the original so its relative imports still resolve.
let toolsRepo = '';
let dist = '';
let cleanupToolsRepo = async () => {};

const build = async (cwd: string, options?: McpConfigOptions) => {
  const rslib = await createRslib({ cwd, config: defineMcpConfig(options) });
  await rslib.build();
};

const listFiles = async (dir: string, prefix = ''): Promise<string[]> => {
  const entries = await readdir(path.join(dir, prefix), {
    withFileTypes: true,
  });
  const nested = await Promise.all(
    entries.map((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(dir, relative) : [relative];
    })
  );
  return nested.flat().sort();
};

const readTree = async (dir: string) =>
  new Map(
    await Promise.all(
      (await listFiles(dir)).map(
        async (file) =>
          [file, new Uint8Array(await readFile(path.join(dir, file)))] as const
      )
    )
  );

// Captures what the preset logs while a build runs.
const captureErrors = async (run: () => Promise<void>) => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    await run();
    return { error: undefined, lines };
  } catch (error) {
    return { error: error as Error, lines };
  } finally {
    console.error = original;
  }
};

describe('defineMcpConfig over a tools repo', () => {
  beforeAll(async () => {
    ({ root: toolsRepo, cleanup: cleanupToolsRepo } = await materializeFixture(
      'tools-repo',
      fixtures
    ));
    dist = path.join(toolsRepo, 'dist');
    await build(toolsRepo);
  }, 180_000);
  afterAll(() => cleanupToolsRepo());

  it('writes exactly the provider artifact', async () => {
    expect(await listFiles(dist)).toEqual([
      'catalog.json',
      'mcp-provider.json',
      'skills/quote-a-deal/SKILL.md',
      'skills/quote-a-deal/assets/logo.bin',
      'skills/quote-a-deal/references/Zebra.md',
      'skills/quote-a-deal/references/apple.md',
      'skills/quote-a-deal/references/price-book.md',
      'skills/quote-a-deal/scripts/check.ts',
      'skills/release-a-frontend/SKILL.md',
      'tools/index.js',
    ]);
  });

  it('writes a catalog that parses and matches the emitted runtime module', async () => {
    const descriptor = parseProviderDescriptor(
      await readFile(path.join(dist, 'mcp-provider.json'))
    );
    expect(descriptor).toEqual({
      manifestVersion: 1,
      name: 'tools-basic',
      version: '1.0.0',
      catalog: 'catalog.json',
      generator: { name: 'zephyr-mcp/rslib', version: packageVersion },
    });
    const catalog = parseCatalogManifest(
      await readFile(path.join(dist, 'catalog.json')),
      { descriptor }
    );
    const module = await readFile(path.join(dist, 'tools/index.js'));
    expect(catalog.runtime).toEqual({
      protocol: 1,
      entry: 'tools/index.js',
      modules: [
        {
          path: 'tools/index.js',
          size: module.byteLength,
          sha256: await sha256Hex(module),
        },
      ],
      compatibilityDate: '2026-07-01',
      compatibilityFlags: ['enable_request_signal'],
    });

    const expected = JSON.parse(
      await readFile(
        path.join(fixtures, 'contract/repos/skills-basic.expected-catalog.json'),
        'utf8'
      )
    ) as CatalogManifest;
    expect(catalog.skills).toEqual(expected.skills);

    expect(catalog.tools.map((tool) => tool.name)).toEqual(['quote_price', 'slow_echo']);
    const [quotePrice] = catalog.tools;
    expect(quotePrice).toMatchObject({
      description: 'Price a basket with the checkout pricing rules.',
      inputSchema: {
        type: 'object',
        properties: { sku: { type: 'string' } },
        required: ['sku', 'quantity'],
      },
      outputSchema: {
        type: 'object',
        properties: { total: { type: 'number' } },
        required: ['total'],
      },
      annotations: { readOnlyHint: true },
    });
    expect(quotePrice?.inputSchema).not.toHaveProperty('$schema');
  });

  it('passes the artifact checks', async () => {
    expect(await checkArtifact(await readTree(dist))).toEqual([]);
  });

  it('emits one self-contained module that answers the protocol', async () => {
    const source = await readFile(path.join(dist, 'tools/index.js'), 'utf8');
    expect(runtimeModuleProblems(source)).toEqual([]);
    expect(source).not.toMatch(/from ['"]yaml['"]/);

    const { default: worker } = (await import(
      `${pathToFileURL(path.join(dist, 'tools/index.js')).href}?test`
    )) as { default: ProviderFetcher };
    expect(Object.keys(worker)).toEqual(['fetch']);
    const provider = (worker as unknown as Record<symbol, SkillsProvider>)[
      PROVIDER_SYMBOL
    ];
    expect(provider).toMatchObject({ name: 'tools-basic', version: '1.0.0' });

    expect(
      await callProviderWorker(worker, {
        name: 'quote_price',
        arguments: { sku: 'SKU-42', quantity: 3 },
      })
    ).toEqual({
      content: [{ type: 'text', text: '3 x SKU-42 = 30.00 EUR' }],
      structuredContent: { total: 30 },
    });
    expect(
      await callProviderWorker(worker, {
        name: 'slow_echo',
        arguments: { message: 'hi', delayMs: 0 },
        context: { client: { name: 'codex' }, caller: { id: 'u1' } },
      })
    ).toMatchObject({
      structuredContent: {
        message: 'hi',
        client: { info: { name: 'codex' } },
        caller: { id: 'u1' },
      },
    });
    expect(
      await callProviderWorker(worker, {
        name: 'slow_echo',
        arguments: { message: 'hi', delayMs: 10_000 },
        context: { deadlineMs: 20 },
      })
    ).toMatchObject({ isError: true });
  });
});

describe('defineMcpConfig failures and options', () => {
  let scratch = '';
  beforeAll(async () => {
    // Inside the repo, so tool files resolve the workspace's packages.
    await mkdir(path.join(fixtures, '.tmp'), { recursive: true });
    scratch = await mkdtemp(path.join(fixtures, '.tmp', 'preset-'));
  });
  afterAll(async () => {
    await rm(path.join(fixtures, '.tmp'), { recursive: true, force: true });
  });

  const makeRepo = async (name: string, files: Record<string, string>) => {
    const root = path.join(scratch, name);
    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), content);
    }
    return root;
  };

  const packageJson = JSON.stringify({
    name: '@acme/broken-tools',
    version: '0.1.0',
    dependencies: { 'zephyr-mcp': '*' },
  });

  it('fails the build with findings for broken tools', async () => {
    const root = await makeRepo('broken', {
      'package.json': packageJson,
      'tools/search.ts':
        "export default { description: 'Reserved.', annotations: { readOnlyHint: true }, handler: () => 'x' };",
      'tools/renamed.ts':
        "export default { name: 'other', description: 'Wrong name.', annotations: { readOnlyHint: true }, handler: () => 'x' };",
      'tools/no_default.ts': 'export const value = 1;',
      'tools/no_hint.ts':
        "export default { description: 'No hints.', handler: () => 'x' };",
      'tools/array_input.ts':
        "export default { description: 'Bad schema.', inputSchema: { type: 'array' }, annotations: { readOnlyHint: true }, handler: () => 'x' };",
      // defineTool returns a definition without a handler unchanged, so the
      // preset gets to report ZD0736 instead of failing on import.
      // JSON.stringify keeps a Windows path's backslashes from becoming escapes.
      'tools/no_handler.ts': `import { defineTool } from ${JSON.stringify(srcIndex)};\nexport default defineTool({ description: 'No handler.', annotations: { readOnlyHint: true } } as never);`,
      'skills/hello/SKILL.md': '---\nname: hello\ndescription: Say hello.\n---\nHello.\n',
    });
    const { error, lines } = await captureErrors(() => build(root));
    expect(error?.message).toMatch(/the provider has 7 error\(s\)/);
    const codes = lines
      .map((line) => /\] (ZD\d{4}) error ([^\s:]+):/.exec(line))
      .filter((match) => match !== null)
      .map((match) => `${match[1]} ${match[2]}`)
      .sort();
    // Each problem once, at its source file: the skill without an owner is
    // not reported again at catalog.json, and the missing hint is reported
    // at the tool file.
    expect(codes).toEqual([
      'ZD0715 skills/hello/SKILL.md',
      'ZD0731 tools/no_hint.ts',
      'ZD0734 tools/search.ts',
      'ZD0735 tools/renamed.ts',
      'ZD0736 tools/no_default.ts',
      'ZD0736 tools/no_handler.ts',
      'ZD0737 tools/array_input.ts',
    ]);
  }, 120_000);

  it('fails when a tool reaches a node:* module', async () => {
    const root = await makeRepo('node-tool', {
      'package.json': packageJson,
      'tools/read_file.ts':
        "import { readFileSync } from 'node:fs';\nexport default { description: 'Reads.', annotations: { readOnlyHint: true }, handler: () => readFileSync('x', 'utf8') };",
    });
    const { error, lines } = await captureErrors(() => build(root));
    // The webworker bundle cannot resolve node:fs at all.
    expect(error?.message).toBe('Rspack build failed.');
    expect(lines.join('\n')).toMatch(/node:fs/);
  }, 120_000);

  it('fails when the bundle keeps an import, even one the bundler leaves external', async () => {
    const root = await makeRepo('external-tool', {
      'package.json': packageJson,
      'tools/connect.ts':
        "import { connect } from 'cloudflare:sockets';\nexport default { description: 'Connects.', annotations: { readOnlyHint: true }, handler: () => String(typeof connect) };",
    });
    const config = defineMcpConfig();
    const [lib] = config.lib as Array<{ output?: Record<string, unknown> }>;
    if (!lib) throw new Error('no lib config');
    lib.output = { ...lib.output, externals: ['cloudflare:sockets'] };
    const { error } = await captureErrors(async () => {
      const rslib = await createRslib({ cwd: root, config });
      await rslib.build();
    });
    expect(error?.message).toMatch(
      /tools\/index\.js must be one self-contained module, but it has a static import/
    );
    expect(await listFiles(path.join(root, 'dist'))).not.toContain('catalog.json');
  }, 120_000);

  it('scans the bundle for secrets, including code from outside tools/', async () => {
    // Built at runtime so no secret-shaped literal lives in the source.
    const token = ['ghp', 'A'.repeat(36)].join('_');
    const root = await makeRepo('leaky-tool', {
      'package.json': packageJson,
      'config/key.txt': `${token}\n`,
      'tools/leaky.ts':
        "import key from '../config/key.txt?raw';\nexport default { description: 'Leaks.', annotations: { readOnlyHint: true }, handler: () => key.length };",
    });
    const { error, lines } = await captureErrors(() => build(root));
    expect(error?.message).toMatch(/the provider has 1 error\(s\)/);
    expect(lines.join('\n')).toMatch(/ZD0733 error tools\/index\.js: .*ghp_…/);
    expect(lines.join('\n')).not.toContain(token);
  }, 120_000);

  it('rebuilds in watch mode with the compatibility date option', async () => {
    const root = await makeRepo('watched', {
      'package.json': packageJson,
      'tools/hello.ts':
        "export default { description: 'First.', annotations: { readOnlyHint: true }, handler: () => 'hi' };",
      'skills/hello/SKILL.md':
        '---\nname: hello\ndescription: Say hello.\nmetadata:\n  owner: a\n  contact: b\n---\nHello.\n',
      'skills/gone/SKILL.md':
        '---\nname: gone\ndescription: Removed later.\nmetadata:\n  owner: a\n  contact: b\n---\nBye.\n',
    });
    const out = path.join(root, 'dist');
    const readCatalog = async () =>
      parseCatalogManifest(await readFile(path.join(out, 'catalog.json')));
    const rslib = await createRslib({
      cwd: root,
      config: defineMcpConfig({ compatibilityDate: '2026-06-01' }),
    });
    const { lines, error } = await captureErrors(async () => {
      const result = await rslib.build({ watch: true });
      // In watch mode build() can resolve before the artifact is written.
      const waitFor = async (
        done: (catalog: CatalogManifest) => boolean
      ): Promise<CatalogManifest> => {
        const deadline = Date.now() + 60_000;
        for (;;) {
          const catalog = await readCatalog().catch(() => undefined);
          if (catalog && done(catalog)) return catalog;
          if (Date.now() > deadline) throw new Error('no build');
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      };
      try {
        const first = await waitFor(() => true);
        expect(first.runtime?.compatibilityDate).toBe('2026-06-01');
        expect(first.skills.map((skill) => skill.name)).toEqual(['gone', 'hello']);

        // dist/ now holds the artifact; the rebuild must still pass.
        await rm(path.join(root, 'skills/gone'), { recursive: true });
        await writeFile(
          path.join(root, 'tools/hello.ts'),
          "export default { description: 'Second.', annotations: { readOnlyHint: true }, handler: () => 'hi' };"
        );
        const catalog = await waitFor((next) => next.tools[0]?.description === 'Second.');
        expect(catalog.skills.map((skill) => skill.name)).toEqual(['hello']);
        expect(await listFiles(out)).toEqual([
          'catalog.json',
          'mcp-provider.json',
          'skills/hello/SKILL.md',
          'tools/index.js',
        ]);
      } finally {
        await result.close();
      }
    });
    expect(error).toBeUndefined();
    expect(lines.join('\n')).not.toMatch(/\[zephyr-mcp\]/);
  }, 120_000);

  const ownedSkill = (name: string) =>
    `---\nname: ${name}\ndescription: Say ${name}.\nmetadata:\n  owner: a\n  contact: b\n---\nHello.\n`;

  // zephyr-agent refuses *.map in any case, so the preset never ships one.
  it('never copies a source map into dist, in any case', async () => {
    const root = await makeRepo('maps', {
      'package.json': packageJson,
      'skills/hello/SKILL.md': ownedSkill('hello'),
      'skills/hello/references/notes.md': 'notes',
      'skills/hello/references/notes.MAP': '{}',
      'skills/hello/references/other.Map': '{}',
    });
    await build(root);
    const out = path.join(root, 'dist');
    expect(await listFiles(out)).toEqual([
      'catalog.json',
      'mcp-provider.json',
      'skills/hello/SKILL.md',
      'skills/hello/references/notes.md',
    ]);
    expect(await checkArtifact(await readTree(out))).toEqual([]);
  }, 120_000);

  it('fails the build on a skill over 512 files', async () => {
    const files: Record<string, string> = {
      'package.json': packageJson,
      'skills/many/SKILL.md': ownedSkill('many'),
    };
    for (let index = 0; index < 512; index += 1) {
      files[`skills/many/references/${index}.md`] = 'x';
    }
    const root = await makeRepo('too-many', files);
    const { error, lines } = await captureErrors(() => build(root));
    expect(error?.message).toMatch(/the provider has \d+ error\(s\)/);
    expect(lines.join('\n')).toMatch(
      /ZD0719 error skills\/many: the skill has 513 files; the limit is 512/
    );
    expect(await listFiles(path.join(root, 'dist'))).not.toContain('catalog.json');
  }, 120_000);

  // The Zephyr MCP loads a provider only within [2025-11-17, its own date].
  it('fails on a compatibility date before 2025-11-17 and warns on a late one', async () => {
    const root = await makeRepo('dates', {
      'package.json': packageJson,
      'tools/hello.ts':
        "export default { description: 'Hi.', annotations: { readOnlyHint: true }, handler: () => 'hi' };",
    });
    const early = await captureErrors(() =>
      build(root, { compatibilityDate: '2025-11-16' })
    );
    expect(early.error?.message).toMatch(/the provider has 1 error\(s\)/);
    expect(early.lines.join('\n')).toMatch(
      /ZD0741 error catalog\.json: .*must be 2025-11-17 or later/
    );

    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };
    try {
      await build(root, { compatibilityDate: '2027-01-01' });
    } finally {
      console.warn = warn;
    }
    expect(warnings.join('\n')).toMatch(
      /compatibilityDate 2027-01-01 is later than 2026-07-01; the Zephyr MCP skips every tool/
    );
    const catalog = parseCatalogManifest(
      await readFile(path.join(root, 'dist', 'catalog.json'))
    );
    expect(catalog.runtime?.compatibilityDate).toBe('2027-01-01');
  }, 120_000);

  it('builds a skills-only package without a runtime, with name and version options', async () => {
    const root = await makeRepo('skills-only', {
      'package.json': packageJson,
      'skills/hello/SKILL.md':
        '---\nname: hello\ndescription: Say hello.\nmetadata:\n  owner: a\n  contact: b\n---\nHello.\n',
    });
    await build(root, { name: 'greeter', version: '2.0.0' });
    const out = path.join(root, 'dist');
    expect(await listFiles(out)).toEqual([
      'catalog.json',
      'mcp-provider.json',
      'skills/hello/SKILL.md',
    ]);
    const catalog = parseCatalogManifest(await readFile(path.join(out, 'catalog.json')));
    expect(catalog).toMatchObject({
      provider: { name: 'greeter', version: '2.0.0' },
      tools: [],
    });
    expect(catalog.runtime).toBeUndefined();
  }, 120_000);
});
