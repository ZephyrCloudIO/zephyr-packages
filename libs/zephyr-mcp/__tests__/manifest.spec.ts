import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from '@rstest/core';
import * as z from 'zod';
import {
  buildCatalogManifest,
  CatalogManifestSchema,
  DEFAULT_MIME_TYPE,
  EvalResultsSchema,
  isTextMimeType,
  ManifestError,
  MIME_TYPES,
  mimeTypeFor,
  parseCatalogManifest,
  parseEvalResults,
  parseProviderDescriptor,
  RuleError,
  sha256Hex,
  slug,
  toCatalogTool,
  type CatalogManifest,
} from '../src/manifest';
import { loadRepo } from '../src/repo';
import { materializeFixture } from './helpers/fixtures';

// Binary fixtures are stored as base64 (contract 13.5): tests read a copy
// with the original files decoded.
let contract = '';
let cleanupContract = async () => {};
beforeAll(async () => {
  ({ root: contract, cleanup: cleanupContract } = await materializeFixture('contract'));
});
afterAll(() => cleanupContract());
const readJson = async <T = unknown>(file: string): Promise<T> =>
  JSON.parse(await readFile(path.join(contract, file), 'utf8')) as T;

describe('catalog.json (contract fixtures)', () => {
  it('accepts catalog.json and keeps unknown keys', async () => {
    const descriptor = parseProviderDescriptor(
      await readFile(path.join(contract, 'mcp-provider.json'))
    );
    const catalog = parseCatalogManifest(
      await readFile(path.join(contract, 'catalog.json')),
      { descriptor }
    );
    expect(catalog.provider).toEqual({ name: 'tools-basic', version: '1.0.0' });

    const unknown = parseCatalogManifest(await readJson('catalog-unknown-key.json'));
    expect(unknown['x-future']).toEqual({ ok: true });
    expect(unknown.skills[0]?.files[0]?.['x-note']).toBe('kept');
    expect(unknown.tools[0]?.['icons']).toEqual([]);
    expect(CatalogManifestSchema.safeParse(unknown).success).toBe(true);
  });

  const invalid = [
    ['catalog-invalid-evals-path.json', 'artifact-path-denied'],
    ['catalog-invalid-flags.json', 'artifact-catalog-invalid'],
    ['catalog-invalid-mime.json', 'artifact-catalog-invalid'],
    ['catalog-invalid-reserved-tool.json', 'tool-name-reserved'],
    ['catalog-invalid-runtime-modules.json', 'artifact-catalog-invalid'],
    ['catalog-invalid-runtime-without-tools.json', 'artifact-catalog-invalid'],
    ['catalog-invalid-sha256-uppercase.json', 'artifact-catalog-invalid'],
    ['catalog-invalid-skill-path.json', 'artifact-catalog-invalid'],
    ['catalog-invalid-tool-schema-root.json', 'tool-schema-invalid'],
  ] as const;

  it('covers every catalog-invalid fixture', async () => {
    const files = (await readdir(contract)).filter((file) =>
      file.startsWith('catalog-invalid-')
    );
    expect(files.sort()).toEqual(invalid.map(([file]) => file).sort());
  });

  it.each(invalid)('rejects %s (%s)', async (file, rule) => {
    const json = await readJson(file);
    let error: unknown;
    try {
      parseCatalogManifest(json);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ManifestError);
    expect((error as ManifestError).issues.map((issue) => issue.rule)).toContain(rule);
    expect(CatalogManifestSchema.safeParse(json).success).toBe(false);
  });

  it('requires the provider to match the descriptor', async () => {
    const catalog = await readJson('catalog.json');
    expect(() =>
      parseCatalogManifest(catalog, {
        descriptor: { name: 'other', version: '1.0.0' },
      })
    ).toThrow(/differs from the descriptor name/);
  });

  it('rejects a catalog over 512 KiB and invalid JSON', () => {
    expect(() => parseCatalogManifest(' '.repeat(524_289))).toThrow(
      /the limit is 524288/
    );
    expect(() => parseCatalogManifest('{')).toThrow(/not valid JSON/);
  });

  it('measures a parsed catalog by its JSON byte length', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const padded = { ...catalog, notes: 'x'.repeat(524_288) };
    let error: unknown;
    try {
      parseCatalogManifest(padded);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ManifestError);
    const issues = (error as ManifestError).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      rule: 'artifact-catalog-invalid',
      code: 'ZD0741',
    });
    expect(issues[0]?.message).toMatch(/the limit is 524288/);
  });

  it('rejects a parsed catalog that has no JSON form instead of skipping the limit', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    expect(() => parseCatalogManifest({ ...catalog, counter: BigInt(1) })).toThrow(
      /not JSON-serializable/
    );
  });

  it('rejects catalog bytes that are not UTF-8, with the rule code', () => {
    let error: unknown;
    try {
      parseCatalogManifest(new Uint8Array([0x7b, 0xff, 0x7d]));
    } catch (caught) {
      error = caught;
    }
    expect((error as ManifestError).issues).toEqual([
      {
        rule: 'artifact-catalog-invalid',
        code: 'ZD0741',
        path: '',
        message: 'is not valid UTF-8',
      },
    ]);
  });

  it('pins the runtime entry to tools/index.js', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const runtime = catalog.runtime;
    if (!runtime) throw new Error('fixture changed');
    const moved = {
      ...catalog,
      runtime: {
        ...runtime,
        entry: 'tools/main.js',
        modules: [{ ...runtime.modules[0], path: 'tools/main.js' }],
      },
    };
    expect(() => parseCatalogManifest(moved)).toThrow(/entry must be "tools\/index.js"/);
  });

  it('never rejects on ordering', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const [skill] = catalog.skills;
    skill?.files.reverse();
    catalog.skills.reverse();
    expect(() => parseCatalogManifest(catalog)).not.toThrow();
  });

  it('rejects duplicate names', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    catalog.tools.push(structuredClone(catalog.tools[0]));
    expect(() => parseCatalogManifest(catalog)).toThrow(/listed twice/);
  });
});

describe('unsafe catalog paths', () => {
  it('rejects a skill file path containing NUL', async () => {
    const catalog = await readJson<{
      skills: Array<{ files: Array<{ path: string }> }>;
    }>('catalog.json');
    catalog.skills[0].files[1].path = 'references/x\u0000.md';
    expect(() => parseCatalogManifest(catalog)).toThrow(ManifestError);
  });
});

describe('mcp-provider.json', () => {
  it('matches the expected descriptor shape and is strict', async () => {
    const expected = await readJson<Record<string, unknown>>(
      'repos/skills-basic.expected-descriptor.json'
    );
    const descriptor = parseProviderDescriptor({
      ...expected,
      generator: { name: 'zephyr-cli', version: '1.2.3' },
    });
    expect(descriptor.name).toBe('skills-basic');
    expect(() => parseProviderDescriptor({ ...descriptor, extra: true })).toThrow(
      ManifestError
    );
    expect(() =>
      parseProviderDescriptor({
        ...descriptor,
        generator: { ...descriptor.generator, extra: 1 },
      })
    ).toThrow(ManifestError);
    expect(() => parseProviderDescriptor({ ...descriptor, name: 'Not A Name' })).toThrow(
      /artifact-descriptor-invalid|name/
    );
    expect(() =>
      parseProviderDescriptor({ ...descriptor, catalog: '../catalog.json' })
    ).toThrow(ManifestError);
    expect(() =>
      parseProviderDescriptor({ ...descriptor, catalog: 'other.json' })
    ).toThrow(/catalog\.json/);
    let error: unknown;
    try {
      parseProviderDescriptor('{');
    } catch (caught) {
      error = caught;
    }
    expect((error as ManifestError).issues[0]).toMatchObject({
      rule: 'artifact-descriptor-invalid',
      code: 'ZD0740',
    });
  });
});

describe('the MIME table', () => {
  it('matches mime-table.json', async () => {
    const table = await readJson<{
      extensions: Record<string, string>;
      default: string;
      textTypes: string[];
    }>('mime-table.json');
    expect(MIME_TYPES).toEqual(table.extensions);
    expect(DEFAULT_MIME_TYPE).toBe(table.default);
    for (const [extension, type] of Object.entries(table.extensions)) {
      expect(mimeTypeFor(`references/file.${extension}`)).toBe(type);
      expect(mimeTypeFor(`file.${extension.toUpperCase()}`)).toBe(type);
      const text = table.textTypes.some((textType) =>
        textType.endsWith('/*')
          ? type.startsWith(textType.slice(0, -1))
          : textType === type
      );
      expect(isTextMimeType(type)).toBe(text);
    }
    expect(mimeTypeFor('assets/logo.bin')).toBe(table.default);
    expect(mimeTypeFor('Makefile')).toBe(table.default);
    expect(mimeTypeFor('dir.md/file')).toBe(table.default);
    expect(mimeTypeFor('file.constructor')).toBe(table.default);
    // Node extname semantics, like zephyr-agent: a leading or trailing dot
    // is no extension.
    expect(mimeTypeFor('.md')).toBe(table.default);
    expect(mimeTypeFor('references/.json')).toBe(table.default);
    expect(mimeTypeFor('references/file.')).toBe(table.default);
    expect(mimeTypeFor('references/.config.json')).toBe('application/json');
  });
});

describe('slug', () => {
  it('matches slug.json', async () => {
    const { cases } = await readJson<{
      cases: Array<{ input: string; expected: string | null }>;
    }>('slug.json');
    const derive = (input: string) => {
      try {
        return slug(input);
      } catch {
        return null;
      }
    };
    expect(cases.map(({ input }) => derive(input))).toEqual(
      cases.map(({ expected }) => expected)
    );
  });
});

describe('sha256Hex', () => {
  it('hashes raw bytes and UTF-8 strings', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(await sha256Hex(new Uint8Array([0xff, 0xfe]))).toBe(
      await sha256Hex(new Uint8Array([0xff, 0xfe]).buffer)
    );
  });

  it('reproduces resolve-revision.json', async () => {
    const { cases } = await readJson<{
      cases: Array<{
        providers: Array<{
          providerId: string;
          versionId: string;
          catalogSha256: string;
        }>;
        expected: string;
      }>;
    }>('resolve-revision.json');
    for (const { providers, expected } of cases) {
      const lines = providers.map(
        (p) => `${p.providerId}:${p.versionId}:${p.catalogSha256}`
      );
      expect(await sha256Hex(lines.join('\n'))).toBe(expected);
    }
  });

  it('reproduces the tools-basic catalog digest', async () => {
    const { catalogSha256 } = await readJson<{ catalogSha256: string }>(
      'artifacts/tools-basic.catalog-sha256.json'
    );
    expect(
      await sha256Hex(
        await readFile(path.join(contract, 'artifacts/tools-basic/catalog.json'))
      )
    ).toBe(catalogSha256);
  });
});

describe('buildCatalogManifest', () => {
  it('builds the expected catalog for repos/skills-basic', async () => {
    const expected = await readJson<CatalogManifest>(
      'repos/skills-basic.expected-catalog.json'
    );
    const repo = await loadRepo(path.join(contract, 'repos/skills-basic'));
    const catalog = await buildCatalogManifest({
      provider: { name: 'skills-basic' },
      skills: repo.skills,
    });
    expect(catalog).toEqual(expected);
    expect(JSON.stringify(catalog.skills)).toBe(JSON.stringify(expected.skills));
    expect(parseCatalogManifest(catalog)).toEqual(expected);
  });

  it('sorts in comparison order, never localeCompare', async () => {
    const bytes = new TextEncoder().encode('---\nname: b\ndescription: d\n---\n');
    const catalog = await buildCatalogManifest({
      provider: { name: 'p' },
      skills: [
        {
          name: 'b',
          files: [
            { path: 'references/apple.md', bytes },
            { path: 'references/Zebra.md', bytes },
            { path: 'SKILL.md', bytes },
          ],
        },
      ],
      tools: [
        { name: 'b_tool', description: 'x', inputSchema: { type: 'object' } },
        { name: 'B_tool', description: 'x', inputSchema: { type: 'object' } },
      ],
      runtime: { module: new Uint8Array([1]) },
    });
    expect(catalog.skills[0]?.files.map((file) => file.path)).toEqual([
      'SKILL.md',
      'references/Zebra.md',
      'references/apple.md',
    ]);
    expect(catalog.tools.map((tool) => tool.name)).toEqual(['B_tool', 'b_tool']);
    expect(catalog.runtime).toEqual({
      protocol: 1,
      entry: 'tools/index.js',
      modules: [
        {
          path: 'tools/index.js',
          size: 1,
          sha256: await sha256Hex(new Uint8Array([1])),
        },
      ],
      compatibilityDate: '2026-07-01',
    });
  });

  it('requires a runtime exactly when there are tools', async () => {
    await expect(
      buildCatalogManifest({
        provider: { name: 'p' },
        tools: [{ name: 't', description: 'x', inputSchema: { type: 'object' } }],
      })
    ).rejects.toThrow(/runtime module/);
    await expect(
      buildCatalogManifest({
        provider: { name: 'p' },
        runtime: { module: new Uint8Array() },
      })
    ).rejects.toThrow(/without tools/);
  });

  it('reports a skill without frontmatter with its rule', async () => {
    const error: unknown = await buildCatalogManifest({
      provider: { name: 'p' },
      skills: [
        {
          name: 'x',
          files: [{ path: 'SKILL.md', bytes: new TextEncoder().encode('# x') }],
        },
      ],
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RuleError);
    expect((error as RuleError).code).toBe('ZD0711');
  });
});

describe('toCatalogTool', () => {
  const handler = () => undefined;

  it('converts zod input and output schemas with the right io', () => {
    const tool = toCatalogTool(
      {
        name: 'greet',
        description: 'Greet.',
        inputSchema: z.object({ who: z.string().default('world') }),
        outputSchema: z.object({ text: z.string().default('') }),
        annotations: { title: 'Greeter', readOnlyHint: true },
        handler,
      },
      {}
    );
    expect(tool.title).toBe('Greeter');
    expect(tool.inputSchema).not.toHaveProperty('$schema');
    expect(tool.inputSchema.type).toBe('object');
    // A default makes the field optional as input, but present as output.
    expect(tool.inputSchema['required']).toBeUndefined();
    expect(tool.outputSchema?.['required']).toEqual(['text']);
  });

  it('defaults a missing inputSchema and names it from the file', () => {
    expect(toCatalogTool({ description: 'Ping.', handler }, { name: 'ping' })).toEqual({
      name: 'ping',
      description: 'Ping.',
      inputSchema: { type: 'object' },
    });
  });

  it('passes plain JSON Schema through without $schema', () => {
    const tool = toCatalogTool({
      name: 'plain',
      description: 'Plain.',
      inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: { a: { type: 'string' } },
      },
      handler,
    });
    expect(tool.inputSchema).toEqual({
      type: 'object',
      properties: { a: { type: 'string' } },
    });
  });

  it('inlines a root $ref into $defs', () => {
    const tool = toCatalogTool({
      name: 'tree',
      description: 'A recursive input.',
      inputSchema: {
        $ref: '#/$defs/Node',
        $defs: {
          Node: {
            type: 'object',
            properties: {
              children: { type: 'array', items: { $ref: '#/$defs/Node' } },
            },
          },
        },
      } as never,
      handler,
    });
    expect(tool.inputSchema).toEqual({
      type: 'object',
      properties: {
        children: { type: 'array', items: { $ref: '#/$defs/Node' } },
      },
      $defs: {
        Node: {
          type: 'object',
          properties: {
            children: { type: 'array', items: { $ref: '#/$defs/Node' } },
          },
        },
      },
    });
  });

  it('keeps zod recursive schemas valid', () => {
    interface Category {
      name: string;
      children: Category[];
    }
    const category: z.ZodType<Category> = z.object({
      name: z.string(),
      get children() {
        return z.array(category);
      },
    });
    const tool = toCatalogTool({
      name: 'categories',
      description: 'Recursive.',
      inputSchema: z.object({ root: category }),
      handler,
    });
    expect(tool.inputSchema.type).toBe('object');
    expect(JSON.stringify(tool.inputSchema)).toContain('$ref');
  });

  const failing: Array<[string, unknown]> = [
    ['a non-object root', z.array(z.string())],
    ['a plain schema without type object', { type: 'string' }],
    ['a root $ref outside $defs', { $ref: '#/definitions/x', definitions: {} }],
    [
      'a schema without JSON Schema support',
      {
        '~standard': {
          version: 1,
          vendor: 'old',
          validate: () => ({ value: 1 }),
        },
      },
    ],
    ['a schema whose conversion throws', z.object({ when: z.date() })],
  ];

  it.each(failing)('rejects %s as tool-schema-invalid', (_label, inputSchema) => {
    let error: unknown;
    try {
      toCatalogTool({
        name: 'bad',
        description: 'Bad.',
        inputSchema: inputSchema as never,
        handler,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(RuleError);
    expect(error).toMatchObject({
      rule: 'tool-schema-invalid',
      code: 'ZD0737',
    });
  });

  it('rejects a tool without a description as tool-export-invalid', () => {
    expect(() => toCatalogTool({ name: 'x', description: '', handler })).toThrow(
      expect.objectContaining({ rule: 'tool-export-invalid' }) as never
    );
  });
});

describe('eval results', () => {
  it('accepts eval-results.json and rejects the invalid fixtures', async () => {
    const catalog = await readJson<CatalogManifest>(
      'repos/skills-basic.expected-catalog.json'
    );
    const valid = parseEvalResults(await readJson('eval-results.json'), {
      catalog,
    });
    expect(valid.summary).toEqual({ total: 2, passed: 1 });

    const invalidTotals = await readJson('eval-results-invalid-totals.json');
    expect(() => parseEvalResults(invalidTotals)).toThrow(/summary\/total/);
    // The skill rule needs the catalog the results belong to.
    const invalidSkill = await readJson('eval-results-invalid-skill.json');
    expect(() => parseEvalResults(invalidSkill)).not.toThrow();
    expect(() => parseEvalResults(invalidSkill, { catalog })).toThrow(
      /not in the catalog/
    );
  });

  it('rejects eval results bytes that are not UTF-8', () => {
    expect(() => parseEvalResults(new Uint8Array([0x7b, 0xff, 0x7d]))).toThrow(
      /not valid UTF-8/
    );
  });

  it('enforces the cross-field rules', async () => {
    const base = await readJson<Record<string, unknown>>('eval-results.json');
    const results = base['results'] as Array<Record<string, unknown>>;
    const variants: Array<[string, Record<string, unknown>]> = [
      ['passed count', { ...base, summary: { total: 2, passed: 2 } }],
      [
        'duplicate pair',
        {
          ...base,
          results: [results[0], results[0]],
          summary: { total: 2, passed: 2 },
        },
      ],
      ['agent key', { ...base, agent: 'Claude Code' }],
      ['runs', { ...base, results: [{ ...results[0], runs: 0 }, results[1]] }],
      ['passRate', { ...base, results: [{ ...results[0], passRate: 1.5 }, results[1]] }],
      ['format', { ...base, format: 'zephyr-evals/v2' }],
      ['generatedAt', { ...base, generatedAt: 'yesterday' }],
      ['impossible generatedAt', { ...base, generatedAt: '2026-02-31T12:00:00Z' }],
      ['generatedAt without offset', { ...base, generatedAt: '2026-10-09T12:00:00' }],
      // Strict at every level (contract 11.2): unknown keys are rejected.
      ['unknown root key', { ...base, extra: true }],
      [
        'unknown result key',
        { ...base, results: [{ ...results[0], extra: 1 }, results[1]] },
      ],
      [
        'unknown summary key',
        {
          ...base,
          summary: { ...(base['summary'] as object), extra: 1 },
        },
      ],
      [
        'evalId over 256',
        {
          ...base,
          results: [{ ...results[0], evalId: 'e'.repeat(257) }, results[1]],
        },
      ],
      ['empty evalId', { ...base, results: [{ ...results[0], evalId: '' }, results[1]] }],
      [
        'negative durationMs',
        { ...base, results: [{ ...results[0], durationMs: -1 }, results[1]] },
      ],
      [
        'infinite durationMs',
        {
          ...base,
          results: [{ ...results[0], durationMs: Infinity }, results[1]],
        },
      ],
    ];
    for (const [label, value] of variants) {
      let error: unknown;
      try {
        parseEvalResults(value);
      } catch (caught) {
        error = caught;
      }
      expect({ label, rejected: error instanceof ManifestError }).toEqual({
        label,
        rejected: true,
      });
    }
  });

  it('accepts optional seconds, 256-character ids and zero durations', async () => {
    const base = await readJson<Record<string, unknown>>('eval-results.json');
    const results = base['results'] as Array<Record<string, unknown>>;
    for (const generatedAt of [
      '2026-10-09T12:00Z',
      '2026-10-09T12:00+02:00',
      '2026-10-09T12:00:00.123-05:00',
      '2024-02-29T00:00:00Z',
    ]) {
      expect(parseEvalResults({ ...base, generatedAt }).generatedAt).toBe(generatedAt);
    }
    const parsed = parseEvalResults({
      ...base,
      results: [{ ...results[0], evalId: 'e'.repeat(256), durationMs: 0 }, results[1]],
    });
    expect(parsed.results[0]?.evalId).toHaveLength(256);
  });
});

// Contract amendments v2.2 (section 12) in the parsers.
describe('contract 12 amendments', () => {
  const rejection = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      if (error instanceof ManifestError) return error;
      throw error;
    }
    return undefined;
  };

  // 12.4
  it.each([
    ['inputSchema', '$schema'],
    ['inputSchema', '$ref'],
    ['outputSchema', '$schema'],
    ['outputSchema', '$ref'],
  ] as const)('rejects a tool %s with a root %s (ZD0737)', async (key, keyword) => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const tool = catalog.tools[0];
    if (!tool) throw new Error('fixture changed');
    tool[key] = { type: 'object', [keyword]: '#/$defs/X', $defs: {} };
    const error = rejection(() => parseCatalogManifest(catalog));
    expect(error?.issues).toEqual([
      expect.objectContaining({
        rule: 'tool-schema-invalid',
        code: 'ZD0737',
        path: `tools/0/${key}`,
      }),
    ]);
    expect(CatalogManifestSchema.safeParse(catalog).success).toBe(false);
  });

  // 12.5: UTF-16 code units. "😀" is one code point and two code units.
  const emoji = '😀';
  it('counts the descriptor version in UTF-16 code units', async () => {
    const descriptor = await readJson<Record<string, unknown>>('mcp-provider.json');
    expect(
      parseProviderDescriptor({ ...descriptor, version: emoji.repeat(32) }).version
    ).toHaveLength(64);
    expect(
      rejection(() =>
        parseProviderDescriptor({ ...descriptor, version: emoji.repeat(33) })
      )?.issues.map((issue) => issue.path)
    ).toEqual(['version']);
    expect(
      rejection(() =>
        parseProviderDescriptor({
          ...descriptor,
          version: `${'v'.repeat(63)}${emoji}`,
        })
      )
    ).toBeInstanceOf(ManifestError);
  });

  it('counts eval runner and evalId in UTF-16 code units', async () => {
    const base = await readJson<Record<string, unknown>>('eval-results.json');
    const results = base['results'] as Array<Record<string, unknown>>;
    const withResult = (evalId: string) => ({
      ...base,
      results: [{ ...results[0], evalId }, results[1]],
    });
    expect(parseEvalResults({ ...base, runner: emoji.repeat(64) }).runner).toHaveLength(
      128
    );
    expect(
      rejection(() =>
        parseEvalResults({ ...base, runner: emoji.repeat(65) })
      )?.issues.map((issue) => issue.path)
    ).toEqual(['runner']);
    expect(
      parseEvalResults(withResult(emoji.repeat(128))).results[0]?.evalId
    ).toHaveLength(256);
    expect(
      rejection(() => parseEvalResults(withResult(emoji.repeat(129))))?.issues.map(
        (issue) => issue.path
      )
    ).toEqual(['results/0/evalId']);
    expect(
      rejection(() => parseEvalResults(withResult(`${'e'.repeat(255)}${emoji}`)))
    ).toBeInstanceOf(ManifestError);
  });

  it('counts a catalog provider version in UTF-16 code units', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    catalog.provider.version = emoji.repeat(33);
    expect(
      rejection(() => parseCatalogManifest(catalog))?.issues.map((issue) => issue.path)
    ).toEqual(['provider/version']);
  });

  // 12.3: a field type is ZD0714, never ZD0711.
  it('rejects a catalog license that is not a string as ZD0714', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const skill = catalog.skills[0];
    if (!skill) throw new Error('fixture changed');
    (skill.frontmatter as Record<string, unknown>).license = 1;
    expect(
      rejection(() => parseCatalogManifest(catalog))?.issues.map((issue) => issue.code)
    ).toEqual(['ZD0714']);
  });

  // 12.8
  it.each(['2026-02-31', '2026-06-31', '2027-02-29', '2026-00-10'])(
    'rejects the impossible compatibilityDate %s',
    async (date) => {
      const catalog = await readJson<CatalogManifest>('catalog.json');
      if (!catalog.runtime) throw new Error('fixture changed');
      catalog.runtime.compatibilityDate = date;
      expect(
        rejection(() => parseCatalogManifest(catalog))?.issues.map((issue) => issue.path)
      ).toEqual(['runtime/compatibilityDate']);
    }
  );

  it.each([
    '2026-02-31T12:00:00Z',
    '2026-02-30T00:00Z',
    '2027-02-29T00:00:00+01:00',
    '2026-11-31T23:59:59.5-05:00',
  ])('rejects the impossible generatedAt %s', async (generatedAt) => {
    const base = await readJson<Record<string, unknown>>('eval-results.json');
    expect(
      rejection(() => parseEvalResults({ ...base, generatedAt }))?.issues.map(
        (issue) => issue.path
      )
    ).toEqual(['generatedAt']);
  });

  // 11.2: strict at every level, nested results included.
  it.each([
    ['root', (value: Record<string, unknown>) => ({ ...value, note: 1 })],
    [
      'result',
      (value: Record<string, unknown>) => ({
        ...value,
        results: (value['results'] as object[]).map((result) => ({
          ...result,
          note: 1,
        })),
      }),
    ],
    [
      'summary',
      (value: Record<string, unknown>) => ({
        ...value,
        summary: { ...(value['summary'] as object), note: 1 },
      }),
    ],
  ])('rejects an unknown key in the %s', async (_level, edit) => {
    const base = await readJson<Record<string, unknown>>('eval-results.json');
    expect(rejection(() => parseEvalResults(edit(base)))).toBeInstanceOf(ManifestError);
    expect(EvalResultsSchema.safeParse(edit(base)).success).toBe(false);
  });
});
