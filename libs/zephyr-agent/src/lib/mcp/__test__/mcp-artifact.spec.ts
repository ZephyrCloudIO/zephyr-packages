import { describe, expect, it } from '@rstest/core';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZeBuildAsset, ZephyrBuildStats } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../../errors';
import { contractFixtures, readFixtureTree } from '../__fixtures__/read-fixture-tree';
import { zeBuildAssets } from '../../transformers/ze-build-assets';
import {
  MCP_AGENT_KEYS,
  MCP_DEFAULT_MIME_TYPE,
  MCP_MIME_TYPES,
  MCP_MIN_COMPATIBILITY_DATE,
  extractIssuePaths,
  MCP_LIMITS,
  isDeniedMcpArtifactPath,
  isMcpTextMimeType,
  isServedMcpSkillFilePath,
  mapMcpBuildStatsRejection,
  mcpMimeTypeForPath,
  mcpRuntimeModuleProblems,
  parseCatalogManifest,
  parseMcpProviderDescriptor,
  prepareMcpUpload,
  slugifyMcpName,
  validateEvalResults,
  validateMcpArtifact,
  withMcpBuildStats,
} from '../index';

const LOCAL_BUILD_CODE = ZephyrError.toZeCode(ZeErrors.ERR_DEPLOY_LOCAL_BUILD);
const fixtures = contractFixtures;
const artifactRoot = join(fixtures, 'artifacts', 'tools-basic');

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8')) as T;
}

/** Load the tools-basic artifact with its fixture files materialized. */
function loadArtifact(): Map<string, Uint8Array> {
  return new Map(readFixtureTree(artifactRoot));
}

function withCatalog(name: string): Map<string, Uint8Array> {
  const files = loadArtifact();
  files.set('catalog.json', readFileSync(join(fixtures, name)));
  return files;
}

function assetsByPath(files: Map<string, Uint8Array>): Map<string, ZeBuildAsset> {
  return new Map(
    [...files].map(([path, bytes]) => [
      path,
      zeBuildAssets({ filepath: path, content: Buffer.from(bytes) }),
    ])
  );
}

const catalogSkills = new Set(['quote-a-deal', 'release-a-frontend']);

describe('MCP artifact validation (contract section 2)', () => {
  it('accepts the tools-basic artifact and hashes the catalog bytes as uploaded', () => {
    const result = validateMcpArtifact(loadArtifact());

    expect(result.issues).toEqual([]);
    expect(result.descriptor?.name).toBe('tools-basic');
    expect(result.catalogSha256).toBe(
      readJson<{ catalogSha256: string }>('artifacts/tools-basic.catalog-sha256.json')
        .catalogSha256
    );
    expect(result.expectedPaths).toEqual([
      'mcp-provider.json',
      'catalog.json',
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

  it('accepts unknown catalog keys and preserves them', () => {
    const result = validateMcpArtifact(withCatalog('catalog-unknown-key.json'));

    expect(result.issues).toEqual([]);
    expect(result.catalog?.['x-future']).toEqual({ ok: true });
    expect(result.catalog?.tools[0]?.['icons']).toEqual([]);
    expect(result.catalog?.skills[0]?.files[0]?.['x-note']).toBe('kept');
  });

  const invalidCatalogs = readdirSync(fixtures).filter((name) =>
    name.startsWith('catalog-invalid-')
  );

  it('has every invalid catalog fixture', () => {
    expect(invalidCatalogs.length).toBeGreaterThanOrEqual(9);
  });

  it.each(invalidCatalogs)('rejects %s', (name) => {
    const result = validateMcpArtifact(withCatalog(name));
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it.each([
    ['catalog-invalid-reserved-tool.json', 'ZD0734'],
    ['catalog-invalid-tool-schema-root.json', 'ZD0737'],
    ['catalog-invalid-evals-path.json', 'ZD0742'],
    ['catalog-invalid-mime.json', 'ZD0741'],
    ['catalog-invalid-flags.json', 'ZD0741'],
    ['catalog-invalid-runtime-modules.json', 'ZD0741'],
    ['catalog-invalid-runtime-without-tools.json', 'ZD0741'],
    ['catalog-invalid-sha256-uppercase.json', 'ZD0741'],
    ['catalog-invalid-skill-path.json', 'ZD0741'],
  ])('reports %s as %s', (name, code) => {
    const codes = validateMcpArtifact(withCatalog(name)).issues.map(
      (issue) => issue.code
    );
    expect(codes).toContain(code);
  });

  it.each(invalidCatalogs)(
    'rejects %s from the catalog alone, without relying on the file set',
    (name) => {
      const descriptor = parseMcpProviderDescriptor(
        readFileSync(join(fixtures, 'mcp-provider.json'))
      ).descriptor;
      const result = parseCatalogManifest(readFileSync(join(fixtures, name)), descriptor);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.catalog).toBeUndefined();
    }
  );

  it('accepts the valid and unknown-key catalogs on their own', () => {
    const descriptor = parseMcpProviderDescriptor(
      readFileSync(join(fixtures, 'mcp-provider.json'))
    ).descriptor;
    for (const name of ['catalog.json', 'catalog-unknown-key.json']) {
      expect(
        parseCatalogManifest(readFileSync(join(fixtures, name)), descriptor).issues
      ).toEqual([]);
    }
  });

  it('rejects any file outside the exact asset set, and denied paths', () => {
    const files = loadArtifact();
    files.set('README.md', Buffer.from('# extra'));
    files.set('tools/source.ts', Buffer.from('export {}'));
    files.set('skills/quote-a-deal/evals/evals.json', Buffer.from('{}'));
    files.set('tools/index.js.map', Buffer.from('{}'));

    const issues = validateMcpArtifact(files).issues;
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ZD0741', path: 'README.md' }),
        expect.objectContaining({ code: 'ZD0742', path: 'tools/source.ts' }),
        expect.objectContaining({
          code: 'ZD0742',
          path: 'skills/quote-a-deal/evals/evals.json',
        }),
        expect.objectContaining({ code: 'ZD0742', path: 'tools/index.js.map' }),
      ])
    );

    const lenient = validateMcpArtifact(files, { ignoreExtraPaths: true }).issues;
    expect(lenient.map(({ path }) => path)).not.toContain('README.md');
    expect(lenient.map(({ path }) => path)).toContain('tools/source.ts');
  });

  it('checks the raw size and sha256 of every listed file', () => {
    const resized = loadArtifact();
    resized.set('skills/quote-a-deal/references/apple.md', Buffer.from('# Apple'));
    expect(validateMcpArtifact(resized).issues).toContainEqual(
      expect.objectContaining({
        code: 'ZD0741',
        path: 'skills/quote-a-deal/references/apple.md',
        message: expect.stringContaining('Size'),
      })
    );

    const altered = loadArtifact();
    altered.set(
      'skills/quote-a-deal/references/apple.md',
      Buffer.from('# Apple regioN\n')
    );
    expect(validateMcpArtifact(altered).issues).toContainEqual(
      expect.objectContaining({ message: 'sha256 does not match the catalog.' })
    );

    const missing = loadArtifact();
    missing.delete('tools/index.js');
    expect(validateMcpArtifact(missing).issues).toContainEqual(
      expect.objectContaining({ code: 'ZD0741', path: 'tools/index.js' })
    );
  });

  it('rejects unknown descriptor keys and a provider that differs from the descriptor', () => {
    const files = loadArtifact();
    files.set(
      'mcp-provider.json',
      Buffer.from(
        JSON.stringify({
          ...readJson<Record<string, unknown>>('mcp-provider.json'),
          name: 'other-provider',
          extra: true,
        })
      )
    );

    const issues = validateMcpArtifact(files).issues;
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'ZD0740',
        message: 'Unknown descriptor key "extra".',
      })
    );
  });

  it('reports a provider mismatch against a valid descriptor', () => {
    const files = loadArtifact();
    files.set(
      'mcp-provider.json',
      Buffer.from(
        JSON.stringify({
          ...readJson<Record<string, unknown>>('mcp-provider.json'),
          version: '2.0.0',
        })
      )
    );
    expect(validateMcpArtifact(files).issues).toContainEqual(
      expect.objectContaining({
        code: 'ZD0741',
        message: 'provider.version must equal the descriptor version.',
      })
    );
  });

  it('reports duplicate skill and tool names as ZD0743', () => {
    const catalog = readJson<{ skills: unknown[]; tools: unknown[] }>('catalog.json');
    catalog.tools.push(catalog.tools[0]);
    catalog.skills.push(catalog.skills[1]);
    const files = loadArtifact();
    files.set('catalog.json', Buffer.from(JSON.stringify(catalog)));

    const codes = validateMcpArtifact(files).issues.filter(
      ({ code }) => code === 'ZD0743'
    );
    expect(codes).toHaveLength(2);
  });
});

describe('Per-skill limits and served paths (contract section 1, amendment 11.1)', () => {
  type CatalogFile = { path: string; mimeType: string; size: number; sha256: string };
  type Catalog = { skills: Array<{ files: CatalogFile[] }> };
  const descriptor = parseMcpProviderDescriptor(
    readFileSync(join(fixtures, 'mcp-provider.json'))
  ).descriptor;
  const MiB = 1024 * 1024;

  /** The valid catalog with the second skill's files replaced (SKILL.md is kept). */
  function catalogWith(extraFiles: CatalogFile[]): Uint8Array {
    const catalog = readJson<Catalog>('catalog.json');
    const skill = catalog.skills[1] as { files: CatalogFile[] };
    skill.files = [...skill.files, ...extraFiles];
    return Buffer.from(JSON.stringify(catalog));
  }
  function file(path: string, size = 1): CatalogFile {
    return { path, mimeType: mcpMimeTypeForPath(path), size, sha256: '0'.repeat(64) };
  }
  function issuesFor(extraFiles: CatalogFile[]) {
    return parseCatalogManifest(catalogWith(extraFiles), descriptor).issues;
  }

  it('uses the SEP-2640 limits', () => {
    expect(MCP_LIMITS.filesPerSkill).toBe(512);
    expect(MCP_LIMITS.skillTotalBytes).toBe(16 * MiB);
    expect(MCP_LIMITS.skillFileBytes).toBe(5 * MiB);
  });

  it('accepts exactly 512 files and 16 MiB in one skill', () => {
    // SKILL.md is the first file; 511 more makes 512.
    const atFileLimit = Array.from({ length: 511 }, (_, i) =>
      file(`references/r${i}.md`)
    );
    expect(issuesFor(atFileLimit)).toEqual([]);

    const catalog = readJson<Catalog>('catalog.json');
    const skillMdSize = (catalog.skills[1] as { files: CatalogFile[] }).files[0]
      ?.size as number;
    const atByteLimit = [
      file('assets/a.bin', 5 * MiB),
      file('assets/b.bin', 5 * MiB),
      file('assets/c.bin', 5 * MiB),
      file('assets/d.bin', MiB - skillMdSize),
    ];
    expect(issuesFor(atByteLimit)).toEqual([]);
  });

  it('reports 513 files in one skill as ZD0719', () => {
    const files = Array.from({ length: 512 }, (_, i) => file(`references/r${i}.md`));
    expect(issuesFor(files)).toEqual([
      expect.objectContaining({
        code: 'ZD0719',
        message: 'skills[1] lists more than 512 files.',
      }),
    ]);
  });

  it('reports four 5 MiB files (over 16 MiB in total) as ZD0719', () => {
    const files = ['a', 'b', 'c', 'd'].map((name) => file(`assets/${name}.bin`, 5 * MiB));
    expect(issuesFor(files)).toEqual([
      expect.objectContaining({
        code: 'ZD0719',
        message: expect.stringContaining('more than 16777216 (16 MiB)'),
      }),
    ]);
  });

  it('reports a file over 5 MiB as ZD0719 and a malformed size as ZD0741', () => {
    expect(issuesFor([file('assets/big.bin', 5 * MiB + 1)])).toEqual([
      expect.objectContaining({
        code: 'ZD0719',
        message: 'skills[1].files[1].size is larger than 5242880 bytes (5 MiB).',
      }),
    ]);
    expect(issuesFor([file('assets/odd.bin', 1.5)])).toEqual([
      expect.objectContaining({
        code: 'ZD0741',
        message: 'skills[1].files[1].size must be a non-negative integer.',
      }),
    ]);
  });

  it('reports a skill file outside SKILL.md, references/, assets/ and scripts/ as ZD0741 (amendment 12.3)', () => {
    for (const path of ['README.md', 'docs/guide.md', 'referencesx/a.md']) {
      expect(issuesFor([file(path)])).toEqual([
        expect.objectContaining({
          code: 'ZD0741',
          message:
            'skills[1].files[1].path must be SKILL.md or a file under references/, assets/ or scripts/, without a node_modules segment.',
        }),
      ]);
    }
    expect(isServedMcpSkillFilePath('SKILL.md')).toBe(true);
    expect(isServedMcpSkillFilePath('scripts/check.ts')).toBe(true);
    expect(isServedMcpSkillFilePath('skill.md')).toBe(false);
    expect(isServedMcpSkillFilePath('scripts/node_modules/x/index.js')).toBe(false);
    expect(isServedMcpSkillFilePath('scripts/my_node_modules.js')).toBe(true);
  });

  it('reports a node_modules segment as ZD0741, not ZD0742 (amendment 12.3)', () => {
    for (const path of ['scripts/node_modules/x/index.js', 'assets/node_modules/a.bin']) {
      expect(issuesFor([file(path)])).toEqual([
        expect.objectContaining({ code: 'ZD0741' }),
      ]);
    }
  });

  it('keeps ZD0742 for evals, source maps and dot segments in a catalog skill', () => {
    for (const path of [
      'references/EVALS/a.md',
      'assets/app.js.map',
      'assets/.env',
      'references/../SKILL.md',
      'references/./a.md',
    ]) {
      expect(issuesFor([file(path)])).toEqual([
        expect.objectContaining({ code: 'ZD0742' }),
      ]);
    }
  });

  it('reports a backslash, an empty segment or an absolute catalog path as ZD0741 (amendment 13.2)', () => {
    for (const path of [
      'references\\a.md',
      'references//a.md',
      'references/a.md/',
      '/references/a.md',
      '',
    ]) {
      expect(issuesFor([file(path)])).toEqual([
        expect.objectContaining({ code: 'ZD0741', path: 'catalog.json' }),
      ]);
    }
  });

  it('reports unsafe artifact paths as ZD0741 and denied ones as ZD0742', () => {
    const files = loadArtifact();
    files.set('skills/quote-a-deal/references\\a.md', Buffer.from('a'));
    files.set('skills/quote-a-deal//a.md', Buffer.from('a'));
    files.set('skills/quote-a-deal/evals/evals.json', Buffer.from('{}'));
    expect(
      validateMcpArtifact(files)
        .issues.map(({ code, path }) => `${code} ${path}`)
        .sort()
    ).toEqual([
      'ZD0741 skills/quote-a-deal//a.md',
      'ZD0741 skills/quote-a-deal/references\\a.md',
      'ZD0742 skills/quote-a-deal/evals/evals.json',
    ]);
  });
});

describe('runtime.compatibilityDate floor (amendment 13.1)', () => {
  const descriptor = parseMcpProviderDescriptor(
    readFileSync(join(fixtures, 'mcp-provider.json'))
  ).descriptor;
  const issuesFor = (compatibilityDate: string) => {
    const catalog = readJson<{ runtime: Record<string, unknown> }>('catalog.json');
    catalog.runtime['compatibilityDate'] = compatibilityDate;
    return parseCatalogManifest(Buffer.from(JSON.stringify(catalog)), descriptor).issues;
  };

  it('accepts 2025-11-17 and later', () => {
    expect(MCP_MIN_COMPATIBILITY_DATE).toBe('2025-11-17');
    expect(issuesFor('2025-11-17')).toEqual([]);
    expect(issuesFor('2026-01-01')).toEqual([]);
  });

  it('reports a date earlier than 2025-11-17 as ZD0741', () => {
    expect(issuesFor('2025-11-16')).toEqual([
      {
        code: 'ZD0741',
        path: 'catalog.json',
        message:
          'runtime.compatibilityDate must be 2025-11-17 or later; the Zephyr MCP does not load earlier dates.',
      },
    ]);
  });
});

describe('Served SKILL.md frontmatter matches the catalog (amendment 13.4)', () => {
  const skillPath = 'skills/release-a-frontend/SKILL.md';
  const description =
    'Release a frontend version through Zephyr environments. Use when asked to ship or roll back a web app.';

  /** Tools-basic with release-a-frontend's SKILL.md replaced and its digest kept in sync. */
  function withSkillMarkdown(markdown: string): Map<string, Uint8Array> {
    const files = loadArtifact();
    const bytes = Buffer.from(markdown);
    files.set(skillPath, bytes);
    const catalog = readJson<{
      skills: Array<{ files: Array<{ path: string; size: number; sha256: string }> }>;
    }>('catalog.json');
    const entry = catalog.skills[1]!.files.find(({ path }) => path === 'SKILL.md')!;
    entry.size = bytes.byteLength;
    entry.sha256 = createHash('sha256').update(bytes).digest('hex');
    files.set('catalog.json', Buffer.from(JSON.stringify(catalog)));
    return files;
  }
  const issuesFor = (markdown: string) =>
    validateMcpArtifact(withSkillMarkdown(markdown)).issues.map(
      ({ code, path }) => `${code} ${path}`
    );

  it('reports frontmatter that differs from the catalog as ZD0741 at the SKILL.md', () => {
    expect(
      issuesFor(
        `---\nname: release-a-frontend\ndescription: ${description}\nlicense: Apache-2.0\nmetadata:\n  owner: platform\n  contact: platform@example.com\n---\n# Release\n`
      )
    ).toEqual([`ZD0741 ${skillPath}`]);
  });

  it('ignores key order', () => {
    expect(
      issuesFor(
        `---\nmetadata:\n  contact: platform@example.com\n  owner: platform\nlicense: MIT\ndescription: ${description}\nname: release-a-frontend\n---\n# Release\n`
      )
    ).toEqual([]);
  });

  it('reports a SKILL.md whose frontmatter does not parse as ZD0711', () => {
    expect(issuesFor('# No frontmatter\n')).toEqual([`ZD0711 ${skillPath}`]);
    expect(
      issuesFor(`---\nname: release-a-frontend\nname: again\n---\n# Duplicate key\n`)
    ).toEqual([`ZD0711 ${skillPath}`]);
  });

  it('does not compare a SKILL.md that already fails its catalog digest', () => {
    const files = loadArtifact();
    files.set(skillPath, Buffer.from('# changed\n'));
    expect(
      validateMcpArtifact(files).issues.map(({ code, path }) => `${code} ${path}`)
    ).toEqual([`ZD0741 ${skillPath}`]);
  });

  it('rejects a bundler-plugin upload whose SKILL.md differs from the catalog', () => {
    const files = withSkillMarkdown(
      `---\nname: release-a-frontend\ndescription: Something else.\nlicense: MIT\nmetadata:\n  owner: platform\n  contact: platform@example.com\n---\n`
    );
    expect(() =>
      prepareMcpUpload({
        assetsByPath: assetsByPath(files),
        appConfig: { MCP_PRIVATE_SNAPSHOTS: true },
        baseHref: undefined,
      })
    ).toThrow(`ZD0741 ${skillPath}`);
  });
});

describe('Catalog frontmatter codes in mode A (amendment 12.3)', () => {
  const descriptor = parseMcpProviderDescriptor(
    readFileSync(join(fixtures, 'mcp-provider.json'))
  ).descriptor;
  type Skill = { name: string; frontmatter: Record<string, unknown> };

  function codesWith(mutate: (skill: Skill) => void) {
    const catalog = readJson<{ skills: Skill[] }>('catalog.json');
    mutate(catalog.skills[1] as Skill);
    return parseCatalogManifest(
      Buffer.from(JSON.stringify(catalog)),
      descriptor
    ).issues.map(({ code, path }) => `${code} ${path}`);
  }

  it.each([
    ['a frontmatter name that differs from the skill', 'ZD0712', { name: 'other-skill' }],
    ['a missing frontmatter name', 'ZD0712', { name: undefined }],
    ['a missing description', 'ZD0713', { description: undefined }],
    ['an empty description', 'ZD0713', { description: '' }],
    ['a description over 1,024 characters', 'ZD0713', { description: 'd'.repeat(1025) }],
    ['a compatibility over 500 characters', 'ZD0714', { compatibility: 'c'.repeat(501) }],
    ['a non-string compatibility', 'ZD0714', { compatibility: 1 }],
    ['a non-string metadata value', 'ZD0714', { metadata: { owner: 1 } }],
    ['a metadata list', 'ZD0714', { metadata: ['owner'] }],
    ['a non-string license', 'ZD0714', { license: 3 }],
    ['a non-string allowed-tools', 'ZD0714', { 'allowed-tools': ['Read'] }],
  ])('reports %s as %s', (_case, code, change) => {
    expect(codesWith((skill) => Object.assign(skill.frontmatter, change))).toEqual([
      `${code} catalog.json`,
    ]);
  });

  it('reports an invalid skill name as ZD0712', () => {
    expect(
      codesWith((skill) => {
        skill.name = 'Not_Valid';
      })
    ).toEqual(['ZD0712 catalog.json']);
  });

  it('counts description length in UTF-16 code units (amendment 12.5)', () => {
    expect(
      codesWith((skill) => {
        skill.frontmatter['description'] = '\u{1F600}'.repeat(512);
      })
    ).toEqual([]);
    expect(
      codesWith((skill) => {
        skill.frontmatter['description'] = `${'\u{1F600}'.repeat(512)}x`;
      })
    ).toEqual(['ZD0713 catalog.json']);
  });
});

describe('Runtime module self-containment (amendment 12.2)', () => {
  /** The tools-basic artifact with tools/index.js replaced and the catalog kept in sync. */
  function artifactWithModule(bytes: Uint8Array, syncCatalog = true) {
    const files = loadArtifact();
    files.set('tools/index.js', bytes);
    if (syncCatalog) {
      const catalog = readJson<{
        runtime: { modules: Array<{ size: number; sha256: string }> };
      }>('catalog.json');
      const module = catalog.runtime.modules[0] as { size: number; sha256: string };
      module.size = bytes.byteLength;
      module.sha256 = createHash('sha256').update(bytes).digest('hex');
      files.set('catalog.json', Buffer.from(JSON.stringify(catalog)));
    }
    return files;
  }
  const issuesFor = (source: string | Uint8Array, syncCatalog = true) =>
    validateMcpArtifact(
      artifactWithModule(
        typeof source === 'string' ? Buffer.from(source) : source,
        syncCatalog
      )
    ).issues;

  it('accepts the self-contained fixture module', () => {
    expect(validateMcpArtifact(loadArtifact()).issues).toEqual([]);
    expect(issuesFor('const worker = { fetch() {} };\nexport default worker;\n')).toEqual(
      []
    );
  });

  it.each([
    ['a static import', 'import x from "y";\nexport default x;'],
    ['a bare import', 'import "polyfill";\nexport default {};'],
    ['an export-from', 'export * from "y";'],
    ['a dynamic import()', 'export default { fetch: () => import("y") };'],
    ['a node: specifier', 'const fs = require("node:fs");\nexport default {};'],
    ['a cloudflare: specifier', 'const s = "cloudflare:sockets";\nexport default {};'],
    [
      'an escaped specifier behind a comment',
      '/**/import {connect} from "\\x63loudflare:sockets"; export default {}',
    ],
  ])('reports %s as ZD0741 at tools/index.js', (_case, source) => {
    const issues = issuesFor(source);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue).toEqual({
        code: 'ZD0741',
        path: 'tools/index.js',
        message: expect.stringContaining('must be one self-contained file'),
      });
    }
  });

  it('reports a runtime module that is not UTF-8 as ZD0741', () => {
    expect(issuesFor(Uint8Array.from([0x65, 0x78, 0xff, 0xfe, 0x0a]))).toEqual([
      {
        code: 'ZD0741',
        path: 'tools/index.js',
        message: 'The runtime module is not UTF-8.',
      },
    ]);
  });

  it('checks the module even when the catalog digest is stale', () => {
    const issues = issuesFor('import x from "y";\nexport default x;', false);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'ZD0741',
        path: 'tools/index.js',
        message: expect.stringContaining('static import'),
      })
    );
  });

  it('fails prepareMcpUpload, so every deploy gets the check', () => {
    expect(() =>
      prepareMcpUpload({
        assetsByPath: assetsByPath(artifactWithModule(Buffer.from('import "y";'))),
        appConfig: { MCP_PRIVATE_SNAPSHOTS: true },
        baseHref: undefined,
      })
    ).toThrow('ZD0741 tools/index.js');
  });
});

describe('mcpRuntimeModuleProblems (same cases as @module-federation/mcp)', () => {
  it.each([
    ['import x from "y";', 'static import'],
    ['a();import{b}from"y";', 'static import'],
    ['import "polyfill";', 'static import'],
    ['export * from "y";', 're-exports'],
    ['export{a as b}from"y"', 're-exports'],
    ['const m = await import("y");', 'dynamic import'],
    ['const fs = require("node:fs");', 'node:'],
    ['const s = "cloudflare:sockets";', 'node:'],
  ])('flags %s', (source, problem) => {
    expect(mcpRuntimeModuleProblems(source).join(' ')).toContain(problem);
  });

  it.each([
    ['/**/import {connect} from "\\x63loudflare:sockets"; export default {}'],
    ['a()/* x */;import/* y */{b}/* z */from/**/"y"'],
    ['const k = 1; // note\nimport x from "y"'],
    ['export/**/*/**/from"y"'],
    ['const m = import/**/("y")'],
  ])('sees through comments and escapes: %s', (source) => {
    expect(mcpRuntimeModuleProblems(source)).not.toEqual([]);
  });

  it('accepts a self-contained module', () => {
    expect(
      mcpRuntimeModuleProblems(
        'const important = import.meta.url; const x = { imports: 1 };\nexport { x as default };'
      )
    ).toEqual([]);
    // The word in a string or a property is not an import.
    expect(
      mcpRuntimeModuleProblems(
        'const kind = "import"; const c = { import: "esm" }; a.import("x");\nexport { c as default };'
      )
    ).toEqual([]);
  });
});

describe('Runtime compatibilityDate (amendment 12.8)', () => {
  const descriptor = parseMcpProviderDescriptor(
    readFileSync(join(fixtures, 'mcp-provider.json'))
  ).descriptor;
  const issuesFor = (compatibilityDate: unknown) => {
    const catalog = readJson<{ runtime: Record<string, unknown> }>('catalog.json');
    catalog.runtime['compatibilityDate'] = compatibilityDate;
    return parseCatalogManifest(
      Buffer.from(JSON.stringify(catalog)),
      descriptor
    ).issues.map(({ message }) => message);
  };

  it('accepts real calendar dates, including a leap day', () => {
    expect(issuesFor('2026-07-01')).toEqual([]);
    expect(issuesFor('2028-02-29')).toEqual([]);
  });

  it.each([
    '2026-02-31',
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-7-1',
  ])('rejects %s', (date) => {
    expect(issuesFor(date)).toEqual([
      'runtime.compatibilityDate must be a YYYY-MM-DD date.',
    ]);
  });
});

describe('MCP rules', () => {
  it('maps every extension in the normative MIME table', () => {
    const table = readJson<{
      extensions: Record<string, string>;
      default: string;
      textTypes: string[];
    }>('mime-table.json');

    expect(MCP_MIME_TYPES).toEqual(table.extensions);
    expect(MCP_DEFAULT_MIME_TYPE).toBe(table.default);
    for (const [extension, type] of Object.entries(table.extensions)) {
      expect(mcpMimeTypeForPath(`dir/file.${extension.toUpperCase()}`)).toBe(type);
    }
    expect(mcpMimeTypeForPath('Makefile')).toBe(table.default);
    expect(mcpMimeTypeForPath('logo.bin')).toBe(table.default);
    expect(isMcpTextMimeType('text/markdown')).toBe(true);
    expect(isMcpTextMimeType('application/yaml')).toBe(true);
    expect(isMcpTextMimeType('image/png')).toBe(false);
  });

  it('slugifies names per contract section 1.1', () => {
    const { cases } = readJson<{
      cases: Array<{ input: string; expected: string | null }>;
    }>('slug.json');
    for (const { input, expected } of cases) {
      expect(slugifyMcpName(input) ?? null).toBe(expected);
    }
  });

  it('denies evals, source maps, dot segments and TypeScript under tools/', () => {
    expect(isDeniedMcpArtifactPath('skills/a/EVALS/x.json')).toBe(true);
    expect(isDeniedMcpArtifactPath('skills/a/references/app.js.map')).toBe(true);
    expect(isDeniedMcpArtifactPath('skills/a/assets/.hidden')).toBe(true);
    expect(isDeniedMcpArtifactPath('tools/index.mts')).toBe(true);
    expect(isDeniedMcpArtifactPath('tools/helpers/Index.TS')).toBe(true);
    expect(isDeniedMcpArtifactPath('skills/a/assets/bundle.js.MAP')).toBe(true);
    // node_modules is ZD0741 (not served), not part of the ZD0742 set (amendment 12.3).
    expect(isDeniedMcpArtifactPath('skills/a/scripts/node_modules/x/i.js')).toBe(false);
    expect(isDeniedMcpArtifactPath('node_modules/x/index.js')).toBe(false);
    expect(isDeniedMcpArtifactPath('skills/a/scripts/my_node_modules.js')).toBe(false);
    expect(isDeniedMcpArtifactPath('skills/a/scripts/check.ts')).toBe(false);
    expect(isDeniedMcpArtifactPath('tools/index.js')).toBe(false);
  });
});

describe('EvalResults v1 (contract section 3.1)', () => {
  it('accepts exactly the canonical agent keys from agents.json', () => {
    const { canonicalKeys } = readJson<{ canonicalKeys: string[] }>('agents.json');
    expect(MCP_AGENT_KEYS).toEqual(canonicalKeys);

    const base = readJson<Record<string, unknown>>('eval-results.json');
    for (const agent of canonicalKeys) {
      expect(validateEvalResults({ ...base, agent }, catalogSkills).issues).toEqual([]);
    }
  });

  it('accepts the fixture against the catalog skills', () => {
    const result = validateEvalResults(readJson('eval-results.json'), catalogSkills);
    expect(result.issues).toEqual([]);
    expect(result.evalResults?.summary).toEqual({ total: 2, passed: 1 });
  });

  it('rejects totals that do not match the results', () => {
    const { issues } = validateEvalResults(
      readJson('eval-results-invalid-totals.json'),
      catalogSkills
    );
    expect(issues).toContainEqual(expect.objectContaining({ path: 'summary.total' }));
  });

  it('rejects a skill that is not in the catalog', () => {
    const { issues } = validateEvalResults(
      readJson('eval-results-invalid-skill.json'),
      catalogSkills
    );
    expect(issues).toContainEqual(expect.objectContaining({ path: 'results[0].skill' }));
  });

  describe('is strict at every level (amendment 11.2)', () => {
    const base = readJson<Record<string, unknown>>('eval-results.json');
    const results = base['results'] as Record<string, unknown>[];
    const summary = base['summary'] as Record<string, unknown>;

    it.each([
      ['the root', { ...base, ciRun: 7 }, 'ciRun'],
      [
        'a result',
        { ...base, results: [{ ...results[0], notes: 'x' }, results[1]] },
        'results[0].notes',
      ],
      ['the summary', { ...base, summary: { ...summary, failed: 1 } }, 'summary.failed'],
    ])('rejects an unknown key in %s', (_level, document, path) => {
      const result = validateEvalResults(document, catalogSkills);
      expect(result.evalResults).toBeUndefined();
      expect(result.issues).toEqual([{ path, message: 'Unknown key.' }]);
    });

    it('keeps an unknown key printable and bounded in the issue path', () => {
      const { issues } = validateEvalResults(
        { ...base, [`bad key\n${'k'.repeat(100)}`]: true },
        catalogSkills
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]?.path).toMatch(/^bad_key_k+\.\.\.$/);
      expect(issues[0]?.path).toHaveLength(64);
    });
  });

  it('bounds evalId to 1..256 characters and durationMs to finite numbers >= 0', () => {
    const base = readJson<Record<string, unknown>>('eval-results.json');
    const check = (result: Record<string, unknown>) =>
      validateEvalResults(
        { ...base, results: [result], summary: { total: 1, passed: 1 } },
        catalogSkills
      ).issues.map(({ path }) => path);
    const ok = { skill: 'quote-a-deal', passed: true };

    expect(check({ ...ok, evalId: 'e'.repeat(256), durationMs: 0 })).toEqual([]);
    expect(check({ ...ok, evalId: '' })).toEqual(['results[0].evalId']);
    expect(check({ ...ok, evalId: 'e'.repeat(257) })).toEqual(['results[0].evalId']);
    expect(check({ ...ok, evalId: '1', durationMs: Number.POSITIVE_INFINITY })).toEqual([
      'results[0].durationMs',
    ]);
    expect(check({ ...ok, evalId: '1', durationMs: '5' })).toEqual([
      'results[0].durationMs',
    ]);
  });

  it('accepts only real ISO 8601 date-times for generatedAt, like the API', () => {
    const base = readJson<Record<string, unknown>>('eval-results.json');
    const issuesFor = (generatedAt: unknown) =>
      validateEvalResults({ ...base, generatedAt }, catalogSkills).issues.map(
        ({ path }) => path
      );

    for (const valid of [
      '2026-10-09T12:00:00Z',
      '2026-10-09T12:00Z',
      '2026-10-09T23:59:59.123+02:00',
      '2028-02-29T00:00:00-11:30',
    ]) {
      expect(issuesFor(valid)).toEqual([]);
    }
    for (const invalid of [
      '2026-02-30T12:00:00Z',
      '2026-02-29T12:00:00Z',
      '2026-13-01T12:00:00Z',
      '2026-10-09T24:00:00Z',
      '2026-10-09T12:60:00Z',
      '2026-10-09T12:00:60Z',
      '2026-10-09T12:00:00+24:00',
      '2026-10-09T12:00:00',
      '2026-10-09',
      1_760_000_000,
    ]) {
      expect(issuesFor(invalid)).toEqual(['generatedAt']);
    }
  });

  it('rejects duplicates, bad ranges and non-canonical agents', () => {
    const base = readJson<Record<string, unknown>>('eval-results.json');
    const { issues } = validateEvalResults(
      {
        ...base,
        agent: 'Claude Code',
        results: [
          { skill: 'quote-a-deal', evalId: '1', passed: true, runs: 0, passRate: 2 },
          { skill: 'quote-a-deal', evalId: '1', passed: false, durationMs: -1 },
        ],
        summary: { total: 2, passed: 1 },
      },
      catalogSkills
    );
    const paths = issues.map(({ path }) => path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'agent',
        'results[0].runs',
        'results[0].passRate',
        'results[1]',
        'results[1].durationMs',
      ])
    );
  });
});

describe('prepareMcpUpload (contract section 3)', () => {
  const eligible = { MCP_PRIVATE_SNAPSHOTS: true };

  it('returns names and paths for the snapshot and the inline catalog for build stats', () => {
    const plan = prepareMcpUpload({
      assetsByPath: assetsByPath(loadArtifact()),
      appConfig: eligible,
      baseHref: '/',
      evalResults: readJson('eval-results.json'),
    });

    expect(plan?.snapshot).toEqual({
      manifestVersion: 1,
      name: 'tools-basic',
      descriptor: 'mcp-provider.json',
      catalog: 'catalog.json',
      catalogSha256: '446fbba346591f3570fff6937e35c2836b1682943801e11737f1df8c7f3ca209',
      entry: 'tools/index.js',
    });
    expect(plan?.buildStats).toMatchObject({
      manifestVersion: 1,
      descriptor: readJson('mcp-provider.json'),
      catalog: readJson('catalog.json'),
      evalResults: readJson('eval-results.json'),
    });
  });

  it('fails closed when the application is not eligible for private snapshots', () => {
    for (const appConfig of [{}, { MCP_PRIVATE_SNAPSHOTS: false }]) {
      expect(() =>
        prepareMcpUpload({
          assetsByPath: assetsByPath(loadArtifact()),
          appConfig,
          baseHref: undefined,
        })
      ).toThrow('not eligible for private MCP snapshots');
    }
  });

  it('fails closed for a baseHref other than empty or "/"', () => {
    expect(() =>
      prepareMcpUpload({
        assetsByPath: assetsByPath(loadArtifact()),
        appConfig: eligible,
        baseHref: '/docs',
      })
    ).toThrow('baseHref');
  });

  it('fails an invalid artifact with ERR_DEPLOY_LOCAL_BUILD and issue paths only', () => {
    let error: unknown;
    try {
      prepareMcpUpload({
        assetsByPath: assetsByPath(withCatalog('catalog-invalid-reserved-tool.json')),
        appConfig: eligible,
        baseHref: undefined,
      });
    } catch (caught) {
      error = caught;
    }
    expect(ZephyrError.is(error)).toBe(true);
    expect((error as ZephyrError<'ERR_DEPLOY_LOCAL_BUILD'>).code).toBe(LOCAL_BUILD_CODE);
    expect(String((error as Error).message)).toContain('ZD0734 catalog.json');
  });

  it('ignores a nested descriptor with a warning and rejects eval results without one', () => {
    const warnings: string[] = [];
    const nested = new Map([
      [
        'docs/mcp-provider.json',
        zeBuildAssets({ filepath: 'docs/mcp-provider.json', content: '{}' }),
      ],
    ]);
    expect(
      prepareMcpUpload({
        assetsByPath: nested,
        appConfig: {},
        baseHref: undefined,
        warn: (message) => warnings.push(message),
      })
    ).toBeUndefined();
    expect(warnings[0]).toContain('docs/mcp-provider.json');

    expect(() =>
      prepareMcpUpload({
        assetsByPath: nested,
        appConfig: {},
        baseHref: undefined,
        evalResults: readJson('eval-results.json'),
      })
    ).toThrow('no root mcp-provider.json');
  });

  it('rejects eval results that do not match the catalog', () => {
    expect(() =>
      prepareMcpUpload({
        assetsByPath: assetsByPath(loadArtifact()),
        appConfig: eligible,
        baseHref: undefined,
        evalResults: readJson('eval-results-invalid-skill.json'),
      })
    ).toThrow('Invalid eval results');
  });

  it('rejects eval results with an unknown key before any upload', () => {
    const base = readJson<Record<string, unknown>>('eval-results.json');
    expect(() =>
      prepareMcpUpload({
        assetsByPath: assetsByPath(loadArtifact()),
        appConfig: eligible,
        baseHref: undefined,
        evalResults: { ...base, ciRun: 7 } as never,
      })
    ).toThrow('- ciRun: Unknown key.');
  });

  it('publishes build stats without a remote or MF manifest and waits for completion', () => {
    const stats = withMcpBuildStats(
      {
        remote: 'remoteEntry.js',
        mf_manifest: 'mf-manifest.json',
        waitForCompletion: false,
      } as ZephyrBuildStats,
      { manifestVersion: 1 } as never
    );
    expect(stats.remote).toBe('');
    expect(stats).not.toHaveProperty('mf_manifest');
    expect(stats.waitForCompletion).toBe(true);
    expect(stats.mcp).toEqual({ manifestVersion: 1 });
  });
});

describe('mapMcpBuildStatsRejection', () => {
  it('maps a 4xx to ERR_DEPLOY_LOCAL_BUILD with issue paths and never values', () => {
    const error = mapMcpBuildStatsRejection(422, {
      message: 'invalid value "super-secret-value"',
      issues: [
        { path: ['mcp', 'catalog', 'tools', 0, 'name'], message: 'reserved: search' },
        { path: 'mcp.descriptor', message: 'bad "super-secret-value"' },
      ],
    });

    expect(error?.code).toBe(LOCAL_BUILD_CODE);
    expect(error?.message).toContain('HTTP 422');
    expect(error?.message).toContain('mcp.catalog.tools.0.name');
    expect(error?.message).toContain('mcp.descriptor');
    expect(error?.message).not.toContain('super-secret-value');
    expect(error?.message).not.toContain('reserved');
  });

  it('maps a 403 passed through by the gateway, with an access hint when it has no paths', () => {
    const error = mapMcpBuildStatsRejection(403, { error: 'Forbidden' });
    expect(error?.code).toBe(LOCAL_BUILD_CODE);
    expect(error?.message).toContain('HTTP 403');
    expect(error?.message).toContain('can publish this application');
  });

  it('explains the guard 409 with fixed text and never echoes the body', () => {
    const error = mapMcpBuildStatsRejection(409, {
      message: 'Application already has non-MCP versions "super-secret-value"',
    });
    expect(error?.code).toBe(LOCAL_BUILD_CODE);
    expect(error?.message).toContain('HTTP 409');
    expect(error?.message).toContain('publish the MCP provider as its own application');
    expect(error?.message).not.toContain('super-secret-value');
  });

  it('explains a 422 at mcp alone as the default-edge rule', () => {
    const edge = mapMcpBuildStatsRejection(422, {
      error: { issues: [{ path: ['mcp'], message: 'only "super-secret-value"' }] },
    });
    expect(edge?.message).toContain('- mcp');
    expect(edge?.message).toContain('default Zephyr Cloudflare edge');
    expect(edge?.message).not.toContain('super-secret-value');

    const field = mapMcpBuildStatsRejection(422, {
      error: { issues: [{ path: ['mcp', 'catalog'] }, { path: ['mcp'] }] },
    });
    expect(field?.message).not.toContain('default Zephyr Cloudflare edge');
  });

  it('leaves 5xx and success statuses to the transport', () => {
    expect(mapMcpBuildStatsRejection(500, {})).toBeUndefined();
    expect(mapMcpBuildStatsRejection(200, {})).toBeUndefined();
    expect(extractIssuePaths({ error: { issues: [{ path: [] }] } })).toEqual(['(root)']);
  });
});
