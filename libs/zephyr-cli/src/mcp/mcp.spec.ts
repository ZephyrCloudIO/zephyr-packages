import { afterEach, describe, expect, it } from '@rstest/core';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { validateMcpArtifact } from 'zephyr-agent';
import { analyzeProject } from '../doctor/analyze';
import { formatDoctorReport } from '../doctor/format';
import { DOCTOR_SCHEMA_VERSION, DoctorExitCode, DoctorMcpRuleId } from '../doctor/schema';
import {
  captureTree,
  contractFixtures,
  makeTemporaryDirectory,
  materializeFixture,
  readContractJson,
  removeTemporaryDirectories,
  writeFile,
} from './__fixtures__/materialize';
import { classifyMcpDirectory } from './classify';
import { loadEvalResults } from './eval-results';
import { inspectProviderArtifact } from './provider-artifact';
import { buildSkillsRepoArtifact, scanSkillsRepo } from './skills-repo';
import { decodeForSecretScan, findSecrets } from './secrets';
import { checkSkill, findBrokenLinks, parseSkillMarkdown } from './skill-rules';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await removeTemporaryDirectories(temporaryDirectories);
});

const SKILL = (name: string, extra = '') =>
  `---\nname: ${name}\ndescription: Does ${name}.\nmetadata:\n  owner: team\n  contact: team@example.com\n${extra}---\n# ${name}\n`;

describe('MCP classifier (contract section 8.1)', () => {
  it('classifies a root mcp-provider.json as a provider artifact', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    expect(await classifyMcpDirectory(dir)).toEqual({ kind: 'provider-artifact' });
  });

  it('classifies skills/ without package.json as a skills repo', async () => {
    const dir = await materializeFixture(
      'repos/skills-basic',
      'skills-basic',
      temporaryDirectories
    );
    expect(await classifyMcpDirectory(dir)).toEqual({
      kind: 'skills-repo',
      hasPackageJson: false,
    });
  });

  it('rejects tool files without a build in both package and no-package repos', async () => {
    const noPackage = await makeTemporaryDirectory('tools', temporaryDirectories);
    await writeFile(noPackage, 'tools/quote_price.ts', 'export default {};');
    await writeFile(noPackage, 'skills/a/SKILL.md', SKILL('a'));
    expect(await classifyMcpDirectory(noPackage)).toEqual({
      kind: 'tools-without-package-json',
    });

    const optedIn = await makeTemporaryDirectory('tools-repo', temporaryDirectories);
    await writeFile(
      optedIn,
      'package.json',
      JSON.stringify({
        name: 'tools-repo',
        devDependencies: { '@module-federation/mcp': '^0.2.0' },
      })
    );
    await writeFile(optedIn, 'tools/quote_price.ts', 'export default {};');
    expect(await classifyMcpDirectory(optedIn)).toEqual({ kind: 'tools-repo' });
  });

  it('ignores declaration, test, spec, underscore and dot files and tools/ subdirectories', async () => {
    const dir = await makeTemporaryDirectory('skills', temporaryDirectories);
    for (const file of [
      'a.d.ts',
      'a.test.ts',
      'a.spec.ts',
      '_shared.ts',
      '.x.ts',
      '.ts',
      'lib/x.ts',
      'a.js',
    ]) {
      await writeFile(dir, `tools/${file}`, 'export {};');
    }
    await writeFile(dir, 'skills/a/SKILL.md', SKILL('a'));
    expect(await classifyMcpDirectory(dir)).toEqual({
      kind: 'skills-repo',
      hasPackageJson: false,
    });
  });

  it('requires an opt-in for a package with skills, and warns otherwise', async () => {
    const dir = await makeTemporaryDirectory('web-app', temporaryDirectories);
    await writeFile(dir, 'package.json', JSON.stringify({ name: 'web-app' }));
    await writeFile(dir, 'skills/a/SKILL.md', SKILL('a'));
    expect(await classifyMcpDirectory(dir)).toEqual({
      kind: 'legacy',
      publicSkillsDirectory: true,
    });

    await writeFile(
      dir,
      'zephyr.config.ts',
      "// mcp: false\nexport default { appName: 'web-app', mcp: true };\n"
    );
    expect(await classifyMcpDirectory(dir)).toEqual({
      kind: 'skills-repo',
      hasPackageJson: true,
    });
  });

  it('evaluates the zephyr.config opt-in like the engine, so no form of mcp: true falls through', async () => {
    const dir = await makeTemporaryDirectory('spread', temporaryDirectories);
    await writeFile(dir, 'package.json', JSON.stringify({ name: 'spread' }));
    await writeFile(dir, 'skills/a/SKILL.md', SKILL('a'));
    await writeFile(
      dir,
      'zephyr.config.ts',
      "const enabled = Boolean('yes');\nconst base = { mcp: enabled };\nexport default { ...base, appName: 'spread' };\n"
    );
    expect(await classifyMcpDirectory(dir)).toEqual({
      kind: 'skills-repo',
      hasPackageJson: true,
    });
    // Doctor never executes project code and only sees a literal property.
    expect(await classifyMcpDirectory(dir, { zephyrConfig: 'static' })).toEqual({
      kind: 'legacy',
      publicSkillsDirectory: true,
    });
  });

  it('reads the evaluated value, not text that only looks like an opt-in', async () => {
    const dir = await makeTemporaryDirectory('text', temporaryDirectories);
    await writeFile(dir, 'package.json', JSON.stringify({ name: 'text' }));
    await writeFile(dir, 'skills/a/SKILL.md', SKILL('a'));
    await writeFile(
      dir,
      'zephyr.config.ts',
      "export default { ...{ mcp: true }, appName: 'text', mcp: false };\n"
    );
    expect(await classifyMcpDirectory(dir)).toEqual({
      kind: 'legacy',
      publicSkillsDirectory: true,
    });
  });

  it('fails instead of falling back to legacy when the zephyr.config cannot load', async () => {
    const dir = await makeTemporaryDirectory('broken', temporaryDirectories);
    await writeFile(dir, 'package.json', JSON.stringify({ name: 'broken' }));
    await writeFile(dir, 'skills/a/SKILL.md', SKILL('a'));
    await writeFile(dir, 'zephyr.config.ts', "export default { mcp: 'yes' };\n");
    await expect(classifyMcpDirectory(dir)).rejects.toThrow('mcp must be a boolean');
  });

  it('keeps the legacy path for ordinary output', async () => {
    const dir = await makeTemporaryDirectory('dist', temporaryDirectories);
    await writeFile(dir, 'index.html', '<html></html>');
    expect(await classifyMcpDirectory(dir)).toEqual({
      kind: 'legacy',
      publicSkillsDirectory: false,
    });
  });
});

describe('skills repo (contract sections 1 and 2)', () => {
  it('produces no findings and exactly the expected catalog and descriptor', async () => {
    const dir = await materializeFixture(
      'repos/skills-basic',
      'skills-basic',
      temporaryDirectories
    );
    const before = await captureTree(dir);

    const scan = await scanSkillsRepo(dir);
    expect(scan.findings).toEqual(
      readContractJson('repos/skills-basic.expected-findings.json')
    );

    const artifact = buildSkillsRepoArtifact(scan, {
      name: 'skills-basic',
      generatorVersion: '9.9.9',
    });
    expect(artifact.findings).toEqual([]);
    expect(artifact.catalog).toEqual(
      readContractJson('repos/skills-basic.expected-catalog.json')
    );
    const expectedDescriptor = readContractJson<{ generator: { version: string } }>(
      'repos/skills-basic.expected-descriptor.json'
    );
    expectedDescriptor.generator.version = '9.9.9';
    expect(artifact.descriptor).toEqual(expectedDescriptor);

    // The uploaded bytes parse back to the same objects and satisfy the agent's checks.
    expect(
      JSON.parse(Buffer.from(artifact.files.get('catalog.json')!).toString())
    ).toEqual(artifact.catalog);
    expect(validateMcpArtifact(artifact.files).issues).toEqual([]);
    expect([...artifact.files.keys()].sort()).toEqual([
      'catalog.json',
      'mcp-provider.json',
      'skills/quote-a-deal/SKILL.md',
      'skills/quote-a-deal/assets/logo.bin',
      'skills/quote-a-deal/references/Zebra.md',
      'skills/quote-a-deal/references/apple.md',
      'skills/quote-a-deal/references/price-book.md',
      'skills/quote-a-deal/scripts/check.ts',
      'skills/release-a-frontend/SKILL.md',
    ]);
    expect(await captureTree(dir)).toEqual(before);
  });

  it('reports exactly the expected findings for skills-broken', async () => {
    const dir = await materializeFixture(
      'repos/skills-broken',
      'skills-broken',
      temporaryDirectories
    );

    const { findings } = await scanSkillsRepo(dir);
    const actual = findings.map((finding) => ({
      code: finding.code,
      severity: finding.severity,
      skill: finding.evidence[0]?.path.split('/')[1],
    }));
    const expected = readContractJson<
      Array<{ code: string; severity: string; skill: string }>
    >('repos/skills-broken.expected-findings.json');

    const key = (value: { code: string; severity: string; skill?: string }) =>
      `${value.code}|${value.severity}|${value.skill}`;
    expect(actual.map(key).sort()).toEqual(expected.map(key).sort());
    for (const finding of findings) {
      expect(finding.rule).toBe(
        DoctorMcpRuleId[finding.code as keyof typeof DoctorMcpRuleId]
      );
      expect(finding.remediation.length).toBeGreaterThan(0);
    }
    // Secrets are masked to their first four characters.
    const secret = findings.find(({ code }) => code === 'ZD0718');
    expect(secret?.evidence[0]).toEqual({
      path: 'skills/secret-skill/SKILL.md',
      line: 8,
      detail: 'api_…',
    });
    expect(JSON.stringify(findings)).not.toContain('abcd1234efgh5678ijkl');
  });

  it('still scans a served file that is not valid UTF-8 for secrets', async () => {
    const dir = await makeTemporaryDirectory('latin1', temporaryDirectories);
    await writeFile(dir, 'skills/a/SKILL.md', SKILL('a'));
    // A Latin-1 note: one 0xE9 byte makes the file invalid UTF-8.
    const awsKeyId = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
    await writeFile(
      dir,
      'skills/a/references/notes.txt',
      Buffer.concat([
        Buffer.from('caf'),
        Buffer.from([0xe9]),
        Buffer.from(`\naws ${awsKeyId}\n`),
      ])
    );

    const scan = await scanSkillsRepo(dir);
    const secret = scan.findings.find(({ code }) => code === 'ZD0718');
    expect(secret?.evidence[0]).toEqual({
      path: 'skills/a/references/notes.txt',
      line: 2,
      detail: 'AKIA…',
    });
    expect(JSON.stringify(scan.findings)).not.toContain(awsKeyId);
  });

  it('excludes source maps in any case and node_modules, and types license strings', async () => {
    const dir = await makeTemporaryDirectory('edge-cases', temporaryDirectories);
    await writeFile(dir, 'skills/a/SKILL.md', SKILL('a'));
    await writeFile(dir, 'skills/a/references/app.JS.MAP', '{}');
    await writeFile(dir, 'skills/a/references/maps.map/guide.md', '# kept');
    await writeFile(dir, 'skills/node_modules/pkg/SKILL.md', SKILL('pkg'));
    await writeFile(dir, 'skills/b/SKILL.md', SKILL('b', 'license: 3\n'));

    const scan = await scanSkillsRepo(dir);
    expect(scan.skills.map(({ folder }) => folder)).toEqual(['a', 'b']);
    expect([...(scan.skills[0]?.files.keys() ?? [])].sort()).toEqual([
      'SKILL.md',
      'references/maps.map/guide.md',
    ]);
    expect(
      scan.findings.map(({ code, evidence }) => [
        code,
        evidence[0]?.path,
        evidence[0]?.detail,
      ])
    ).toEqual([['ZD0714', 'skills/b/SKILL.md', 'license']]);
  });

  it('reports non-string license and allowed-tools as one ZD0714 with metadata (amendment 12.3)', () => {
    const { findings } = checkSkill({
      folder: 'a',
      evidenceRoot: 'skills/a',
      files: new Map([
        [
          'SKILL.md',
          Buffer.from(
            '---\nname: a\ndescription: Does a.\nlicense: 3\nallowed-tools: [Read]\nmetadata: x\n---\n'
          ),
        ],
      ]),
    });
    expect(
      findings.map(({ code, evidence }) => [code, evidence.map(({ detail }) => detail)])
    ).toEqual([['ZD0714', ['metadata, license, allowed-tools']]]);
  });

  it('parses frontmatter only between exact --- lines and finds broken links', () => {
    expect(
      parseSkillMarkdown(Buffer.from('---\r\nname: a\r\n---\r\nbody'))?.frontmatter
    ).toEqual({ name: 'a' });
    // A UTF-8 BOM means the first line is not exactly ---.
    expect(parseSkillMarkdown(Buffer.from('\uFEFF---\nname: a\n---\n'))).toBeUndefined();
    expect(parseSkillMarkdown(Buffer.from(' ---\nname: a\n---\n'))).toBeUndefined();
    expect(parseSkillMarkdown(Buffer.from('---\n- a\n---\n'))).toBeUndefined();
    expect(parseSkillMarkdown(Buffer.from('---\nname: a\n'))).toBeUndefined();

    const files = new Map([['references/a.md', 1]]);
    expect(
      findBrokenLinks(
        [
          '[ok](references/a.md#top) [web](https://example.com) [anchor](#x)',
          '![img](./references/a.md) [up](../x.md) [missing](references/b.md)',
          '`[code](references/c.md)`',
          '[ref]: references/d.md',
        ].join('\n'),
        files
      )
    ).toEqual(['../x.md', 'references/b.md', 'references/d.md']);
  });

  it('skips code like CommonMark when looking for links', () => {
    const files = new Map([['references/a.md', 1]]);
    const broken = (markdown: string) => findBrokenLinks(markdown, files);

    // A 4-backtick fence is not closed by a 3-backtick line inside it.
    expect(broken('````md\n```\n[x](references/x.md)\n```\n````\n')).toEqual([]);
    // Fences indented up to 3 spaces; 4 spaces is not a fence.
    expect(broken('   ~~~\n[x](references/x.md)\n   ~~~\n')).toEqual([]);
    // A fence closes only on the same character.
    expect(broken('~~~\n[x](references/x.md)\n```\n[y](references/y.md)\n')).toEqual([]);
    // An unclosed fence runs to the end of the document.
    expect(broken('```\n[x](references/x.md)\n')).toEqual([]);
    // Code spans close on a backtick run of the same length.
    expect(broken('``a ` [x](references/x.md) b``')).toEqual([]);
    // Prose after a closed fence is still checked.
    expect(broken('```\ncode\n```\n[after](references/after.md)')).toEqual([
      'references/after.md',
    ]);
    expect(broken('    ```\n[x](references/x.md)')).toEqual(['references/x.md']);
  });

  it('reports a BOM as ZD0711 and non-mapping metadata only as ZD0714', () => {
    const codes = (markdown: string) =>
      checkSkill({
        folder: 'a',
        evidenceRoot: 'skills/a',
        files: new Map([['SKILL.md', Buffer.from(markdown)]]),
      }).findings.map(({ code }) => code);

    expect(codes(`\uFEFF${SKILL('a')}`)).toEqual(['ZD0711']);
    const plain = '---\nname: a\ndescription: Does a.\n';
    expect(codes(`${plain}metadata: x\n---\n`)).toEqual(['ZD0714']);
    expect(codes(`${plain}metadata: null\n---\n`)).toEqual(['ZD0714']);
    expect(codes(`${plain}metadata: [owner]\n---\n`)).toEqual(['ZD0714']);
    expect(codes(`${plain}---\n`)).toEqual(['ZD0715']);
    expect(codes(`${plain}metadata:\n  owner: team\n---\n`)).toEqual(['ZD0715']);
  });
});

describe('per-skill limits (contract amendment 11.1)', () => {
  const MiB = 1024 * 1024;
  const limitFinding = (files: Map<string, Uint8Array>, oversized = new Map()) =>
    checkSkill({ folder: 'a', evidenceRoot: 'skills/a', files, oversized }).findings.find(
      ({ code }) => code === 'ZD0719'
    );
  const skillFiles = (extra: Array<[string, Uint8Array]>) =>
    new Map<string, Uint8Array>([['SKILL.md', Buffer.from(SKILL('a'))], ...extra]);

  it('accepts 512 files and exactly 16 MiB', () => {
    const at512 = skillFiles(
      Array.from({ length: 511 }, (_, i) => [`references/r${i}.md`, new Uint8Array(1)])
    );
    expect(limitFinding(at512)).toBeUndefined();

    const skillMd = Buffer.byteLength(SKILL('a'));
    const at16MiB = skillFiles([
      ['assets/a.bin', new Uint8Array(5 * MiB)],
      ['assets/b.bin', new Uint8Array(5 * MiB)],
      ['assets/c.bin', new Uint8Array(5 * MiB)],
      ['assets/d.bin', new Uint8Array(MiB - skillMd)],
    ]);
    expect(limitFinding(at16MiB)).toBeUndefined();
  });

  it('reports 513 files', () => {
    const files = skillFiles(
      Array.from({ length: 512 }, (_, i) => [`references/r${i}.md`, new Uint8Array(1)])
    );
    expect(limitFinding(files)?.evidence).toEqual([
      { path: 'skills/a', detail: 'files: 513' },
    ]);
  });

  it('reports more than 16 MiB in total, counting files too large to read', () => {
    const files = skillFiles(
      ['a', 'b', 'c'].map((name) => [`assets/${name}.bin`, new Uint8Array(5 * MiB)])
    );
    const finding = limitFinding(files, new Map([['assets/d.bin', 5 * MiB + 1]]));
    expect(finding?.message).toContain('more than 16 MiB in total');
    expect(finding?.evidence).toEqual([
      { path: 'skills/a/assets/d.bin', detail: `bytes: ${5 * MiB + 1}` },
      {
        path: 'skills/a',
        detail: `total bytes: ${15 * MiB + 5 * MiB + 1 + Buffer.byteLength(SKILL('a'))}`,
      },
    ]);
  });

  it('fails a skills repo with 513 files before any upload', async () => {
    const dir = await makeTemporaryDirectory('many', temporaryDirectories);
    await writeFile(dir, 'skills/a/SKILL.md', SKILL('a'));
    for (let i = 0; i < 512; i++) {
      await writeFile(dir, `skills/a/references/r${i}.md`, 'x');
    }
    const scan = await scanSkillsRepo(dir);
    expect(scan.findings.map(({ code }) => code)).toEqual(['ZD0719']);
    expect(scan.skills[0]?.frontmatter).toBeUndefined();
  });
});

describe('secret scan encoding (contract amendment 11.8)', () => {
  it('decodes invalid UTF-8 as latin1, one character per byte', () => {
    // 0xE9 followed by 'A' is not valid UTF-8; 0x80 stays U+0080 (not windows-1252 €).
    expect(decodeForSecretScan(Buffer.from([0x63, 0xe9, 0x41, 0x80, 0xa0]))).toBe(
      'c\u00e9A\u0080\u00a0'
    );
    expect(decodeForSecretScan(Buffer.from('caf\u00e9'))).toBe('caf\u00e9');
  });

  it('counts a latin1 NBSP as whitespace inside a token value', () => {
    const value = Buffer.concat([
      Buffer.from("token = '0123456789"),
      Buffer.from([0xa0]),
      Buffer.from("abcdef'"),
    ]);
    expect(findSecrets('skills/a/references/n.txt', value)).toEqual([]);

    const unbroken = Buffer.concat([
      Buffer.from([0xe9, 0x0a]),
      Buffer.from("token = '0123456789abcdefgh'"),
    ]);
    expect(findSecrets('skills/a/references/n.txt', unbroken)).toEqual([
      { path: 'skills/a/references/n.txt', line: 2, detail: 'toke…' },
    ]);
  });
});

describe('provider artifact (contract sections 2 and 8.2, mode A)', () => {
  it('accepts tools-basic and uploads exactly the contract set, ignoring extras', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    await writeFile(dir, 'README.md', '# not uploaded');
    await writeFile(dir, 'tools/index.js.map', '{}');

    const inspection = await inspectProviderArtifact(dir);

    expect(inspection.findings).toEqual([]);
    expect([...inspection.files.keys()]).toEqual(
      validateMcpArtifact(inspection.files).expectedPaths
    );
    expect(inspection.files.size).toBe(10);
    expect(inspection.ignoredPaths).toEqual(['README.md', 'tools/index.js.map']);
  });

  const invalidCatalogs = fs
    .readdirSync(contractFixtures)
    .filter((name) => name.startsWith('catalog-invalid-'));

  it.each(invalidCatalogs)('rejects %s', async (name) => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    await fs.promises.copyFile(
      path.join(contractFixtures, name),
      path.join(dir, 'catalog.json')
    );

    const { findings } = await inspectProviderArtifact(dir);
    expect(findings.some(({ severity }) => severity === 'error')).toBe(true);
    for (const finding of findings) expect(finding.code).toMatch(/^ZD07\d{2}$/);
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
  ])('reports %s as %s', async (name, code) => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    await fs.promises.copyFile(
      path.join(contractFixtures, name),
      path.join(dir, 'catalog.json')
    );

    const { findings } = await inspectProviderArtifact(dir);
    expect(findings.map((finding) => finding.code)).toContain(code);
  });

  it('accepts catalog-unknown-key.json with no findings', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    await fs.promises.copyFile(
      path.join(contractFixtures, 'catalog-unknown-key.json'),
      path.join(dir, 'catalog.json')
    );

    const inspection = await inspectProviderArtifact(dir);
    expect(inspection.findings).toEqual([]);
    expect(inspection.catalog?.['x-future']).toEqual({ ok: true });
  });

  it('reports a missing tool hint, a bundle secret and a missing listed file', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    const catalog = readContractJson<{
      tools: Array<{ annotations?: unknown }>;
      runtime: { modules: Array<{ size: number; sha256: string }> };
    }>('catalog.json');
    delete catalog.tools[0]!.annotations;
    const bundle = Buffer.from(
      `const token = "ghp_${'a'.repeat(36)}";\nexport default {};\n`
    );
    const { createHash } = await import('node:crypto');
    catalog.runtime.modules[0]!.size = bundle.byteLength;
    catalog.runtime.modules[0]!.sha256 = createHash('sha256')
      .update(bundle)
      .digest('hex');
    await writeFile(dir, 'catalog.json', JSON.stringify(catalog));
    await writeFile(dir, 'tools/index.js', bundle);
    await fs.promises.rm(path.join(dir, 'skills/release-a-frontend/SKILL.md'));

    const codes = (await inspectProviderArtifact(dir)).findings.map(({ code }) => code);
    expect(codes).toEqual(expect.arrayContaining(['ZD0731', 'ZD0733', 'ZD0741']));
  });
});

describe('provider artifact amendments 12.2 and 12.3 (mode A)', () => {
  type CatalogFile = { path: string; size: number; sha256: string };
  type Catalog = {
    skills: Array<{ path: string; files: CatalogFile[] }>;
    runtime: { modules: CatalogFile[] };
  };
  const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

  /** Tools-basic with one file replaced and its catalog entry kept in sync. */
  async function artifactWith(artifactPath: string, content: string | Uint8Array) {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    const bytes = typeof content === 'string' ? Buffer.from(content) : content;
    const catalog = readContractJson<Catalog>('catalog.json');
    const entries = [
      ...catalog.skills.flatMap((skill) =>
        skill.files.map((file) => [`${skill.path}/${file.path}`, file] as const)
      ),
      ...catalog.runtime.modules.map((module) => [module.path, module] as const),
    ];
    const entry = entries.find(([listed]) => listed === artifactPath)?.[1];
    if (!entry) throw new Error(`${artifactPath} is not listed in the catalog`);
    entry.size = bytes.byteLength;
    entry.sha256 = digest(bytes);
    await writeFile(dir, 'catalog.json', JSON.stringify(catalog));
    await writeFile(dir, artifactPath, bytes);
    return dir;
  }
  const evidenceOf = async (dir: string) =>
    (await inspectProviderArtifact(dir)).findings.flatMap(({ code, evidence }) =>
      evidence.map(({ path: evidencePath }) => `${code} ${evidencePath}`)
    );

  it.each([
    ['a static import', 'import x from "y";\nexport default x;\n'],
    ['an export-from', 'export * from "y";\n'],
    ['a dynamic import()', 'export default { fetch: () => import("y") };\n'],
    ['a node: specifier', 'const fs = require("node:fs");\nexport default {};\n'],
    ['a cloudflare: specifier', 'const s = "cloudflare:sockets";\nexport default {};\n'],
  ])(
    'reports a runtime module with %s as ZD0741 at tools/index.js',
    async (_case, source) => {
      const dir = await artifactWith('tools/index.js', source);
      const evidence = await evidenceOf(dir);
      expect(evidence.length).toBeGreaterThan(0);
      expect(new Set(evidence)).toEqual(new Set(['ZD0741 tools/index.js']));
    }
  );

  it('reports a runtime module that is not UTF-8 as ZD0741 at tools/index.js', async () => {
    const dir = await artifactWith('tools/index.js', Uint8Array.from([0x65, 0xff, 0x0a]));
    expect(await evidenceOf(dir)).toEqual(['ZD0741 tools/index.js']);
  });

  it('accepts a self-contained module that only mentions import in strings and properties', async () => {
    const dir = await artifactWith(
      'tools/index.js',
      'const kind = "import"; const c = { import: "esm" };\nexport default { fetch() { return c.import; } };\n'
    );
    expect(await evidenceOf(dir)).toEqual([]);
  });

  const skillPath = 'skills/release-a-frontend/SKILL.md';

  it("reports served SKILL.md frontmatter that differs from the catalog's as ZD0741", async () => {
    const dir = await artifactWith(
      skillPath,
      '---\nname: release-a-frontend\ndescription: Release a frontend version through Zephyr environments. Use when asked to ship or roll back a web app.\nlicense: Apache-2.0\nmetadata:\n  owner: platform\n  contact: platform@example.com\n---\n# Release a frontend\n'
    );
    expect(await evidenceOf(dir)).toEqual([`ZD0741 ${skillPath}`]);
  });

  it('reports a served SKILL.md that does not parse once, as ZD0711', async () => {
    const dir = await artifactWith(skillPath, '# No frontmatter\n');
    expect(await evidenceOf(dir)).toEqual([`ZD0711 ${skillPath}`]);
  });

  it('reports a missing catalog-listed file once as ZD0741, not again as a broken link (amendment 13.2)', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    await fs.promises.rm(path.join(dir, 'skills/quote-a-deal/references/price-book.md'));
    expect(await evidenceOf(dir)).toEqual([
      'ZD0741 skills/quote-a-deal/references/price-book.md',
    ]);
  });

  it('passes catalog-listed denied paths to the agent so doctor reports what deploy does (amendment 13.2)', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    const deniedPath = 'skills/quote-a-deal/assets/.env';
    const bytes = Buffer.from('TOKEN=placeholder\n');
    await writeFile(dir, deniedPath, bytes);
    const catalog = readContractJson<Catalog>('catalog.json');
    catalog.skills[0]!.files.push({
      path: 'assets/.env',
      size: bytes.byteLength,
      sha256: digest(bytes),
    });
    await writeFile(dir, 'catalog.json', JSON.stringify(catalog));

    const doctor = (await evidenceOf(dir)).filter((line) => line.startsWith('ZD0742'));
    expect(doctor).toEqual(['ZD0742 catalog.json', `ZD0742 ${deniedPath}`]);

    // A bundler-plugin deploy of the same output hands the agent every file.
    const output = new Map<string, Uint8Array>();
    for (const file of Object.keys(await captureTree(dir))) {
      output.set(file, await fs.promises.readFile(path.join(dir, file)));
    }
    expect(
      validateMcpArtifact(output)
        .issues.filter(({ code }) => code === 'ZD0742')
        .map(({ code, path: issuePath }) => `${code} ${issuePath}`)
    ).toEqual(doctor);
  });

  it('reports a runtime.compatibilityDate earlier than 2025-11-17 as ZD0741 (amendment 13.1)', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    const catalog = readContractJson<{ runtime: Record<string, unknown> }>(
      'catalog.json'
    );
    catalog.runtime['compatibilityDate'] = '2025-11-16';
    await writeFile(dir, 'catalog.json', JSON.stringify(catalog));
    const { findings } = await inspectProviderArtifact(dir);
    expect(findings).toEqual([
      expect.objectContaining({
        code: 'ZD0741',
        evidence: [
          {
            path: 'catalog.json',
            detail: expect.stringContaining('compatibilityDate must be 2025-11-17'),
          },
        ],
      }),
    ]);

    catalog.runtime['compatibilityDate'] = '2025-11-17';
    await writeFile(dir, 'catalog.json', JSON.stringify(catalog));
    expect((await inspectProviderArtifact(dir)).findings).toEqual([]);
  });

  it('ignores key order when comparing frontmatter', async () => {
    const dir = await artifactWith(
      skillPath,
      '---\nmetadata:\n  contact: platform@example.com\n  owner: platform\nlicense: MIT\ndescription: Release a frontend version through Zephyr environments. Use when asked to ship or roll back a web app.\nname: release-a-frontend\n---\n# Release a frontend\n'
    );
    expect(await evidenceOf(dir)).toEqual([]);
  });

  it('reports catalog frontmatter violations with their specific codes', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    const catalog = readContractJson<{
      skills: Array<{ frontmatter: Record<string, unknown> }>;
    }>('catalog.json');
    const frontmatter = catalog.skills[1]!.frontmatter;
    frontmatter['name'] = 'other-skill';
    frontmatter['description'] = '';
    frontmatter['license'] = 3;
    await writeFile(dir, 'catalog.json', JSON.stringify(catalog));

    const codes = (await inspectProviderArtifact(dir)).findings.map(({ code }) => code);
    expect(codes.sort()).toEqual(['ZD0712', 'ZD0713', 'ZD0714']);
  });
});

describe('folder links (contract amendment 12.7)', () => {
  it('reports a link to a folder as ZD0716, even when files are served under it', () => {
    const files = new Map([
      ['SKILL.md', Buffer.from('')],
      ['references/a.md', Buffer.from('# a')],
    ]);
    expect(
      findBrokenLinks(
        '[dir](references/) [bare](references) [dot](./references/.) [ok](references/a.md)',
        files
      )
    ).toEqual(['references/', 'references', './references/.']);

    const { findings } = checkSkill({
      folder: 'a',
      evidenceRoot: 'skills/a',
      files: new Map([
        ['SKILL.md', Buffer.from(`${SKILL('a')}\nSee [the references](references/).\n`)],
        ['references/a.md', Buffer.from('# a')],
      ]),
    });
    expect(
      findings.map(({ code, evidence }) => [code, evidence[0]?.path, evidence[0]?.detail])
    ).toEqual([['ZD0716', 'skills/a/SKILL.md', 'link: references/']]);
  });
});

describe('--eval-results (contract section 3.1)', () => {
  const skills = new Set(['quote-a-deal', 'release-a-frontend']);

  it('accepts the fixture', async () => {
    const result = await loadEvalResults({
      evalResultsPath: 'eval-results.json',
      cwd: contractFixtures,
      skills,
    });
    expect(result.summary).toEqual({ total: 2, passed: 1 });
  });

  it.each([
    ['eval-results-invalid-totals.json', 'summary.total'],
    ['eval-results-invalid-skill.json', 'results[0].skill'],
    ['missing.json', 'cannot be read'],
    ['catalog-invalid-flags.json', 'format'],
  ])('rejects %s', async (file, message) => {
    await expect(
      loadEvalResults({ evalResultsPath: file, cwd: contractFixtures, skills })
    ).rejects.toThrow(message);
  });

  it.each([
    ['the root', (doc: Record<string, unknown>) => ({ ...doc, ciRun: 7 }), 'ciRun'],
    [
      'a result',
      (doc: Record<string, unknown>) => ({
        ...doc,
        results: (doc['results'] as Record<string, unknown>[]).map((result, index) =>
          index === 0 ? { ...result, notes: 'x' } : result
        ),
      }),
      'results[0].notes',
    ],
    [
      'the summary',
      (doc: Record<string, unknown>) => ({
        ...doc,
        summary: { ...(doc['summary'] as Record<string, unknown>), failed: 1 },
      }),
      'summary.failed',
    ],
  ])('rejects an unknown key in %s (amendment 11.2)', async (_level, mutate, path) => {
    const dir = await makeTemporaryDirectory('evals-strict', temporaryDirectories);
    const document = mutate(
      readContractJson<Record<string, unknown>>('eval-results.json')
    );
    await writeFile(dir, 'eval-results.json', JSON.stringify(document));
    await expect(
      loadEvalResults({ evalResultsPath: 'eval-results.json', cwd: dir, skills })
    ).rejects.toThrow(`- ${path}: Unknown key.`);
  });

  it('rejects malformed JSON', async () => {
    const dir = await makeTemporaryDirectory('evals', temporaryDirectories);
    await writeFile(dir, 'eval-results.json', '{ nope');
    await expect(
      loadEvalResults({ evalResultsPath: 'eval-results.json', cwd: dir, skills })
    ).rejects.toThrow('not valid JSON');
  });
});

describe('ze-cli doctor for MCP providers', () => {
  it('reports a healthy skills repo without package.json and exits 0', async () => {
    const dir = await materializeFixture(
      'repos/skills-basic',
      'skills-basic',
      temporaryDirectories
    );

    const report = await analyzeProject(dir);

    expect(report).toMatchObject({
      schemaVersion: DOCTOR_SCHEMA_VERSION,
      status: 'healthy',
      exitCode: DoctorExitCode.Healthy,
      findings: [],
      mcp: {
        classification: 'skills-repo',
        skills: ['quote-a-deal', 'release-a-frontend'],
        tools: [],
        descriptor: null,
        packageChecks: false,
      },
    });
    expect(DOCTOR_SCHEMA_VERSION).toBe('1.1.0');
    const text = formatDoctorReport(report, 'text');
    expect(text).toContain('MCP provider: skills-repo');
    expect(text).not.toContain('Watch mode');
  });

  it('exits 1 for errors and 0 for warnings alone', async () => {
    const broken = await materializeFixture(
      'repos/skills-broken',
      'skills-broken',
      temporaryDirectories
    );
    const brokenReport = await analyzeProject(broken);
    expect(brokenReport.status).toBe('findings');
    expect(brokenReport.exitCode).toBe(DoctorExitCode.Findings);
    expect(brokenReport.findings[0]?.severity).toBe('error');

    const warnings = await makeTemporaryDirectory('warnings', temporaryDirectories);
    await writeFile(warnings, 'skills/a/SKILL.md', SKILL('a'));
    await writeFile(warnings, 'skills/a/notes.txt', 'stray');
    const warningReport = await analyzeProject(warnings);
    expect(warningReport.summary).toMatchObject({ errors: 0, warnings: 1 });
    expect(warningReport.exitCode).toBe(DoctorExitCode.Healthy);
  });

  it('runs the same in-memory artifact checks as deploy on a skills repo', async () => {
    const dir = await makeTemporaryDirectory('big-catalog', temporaryDirectories);
    await writeFile(
      dir,
      'skills/big/SKILL.md',
      SKILL('big', `x-notes: ${'n'.repeat(600_000)}\n`)
    );

    const report = await analyzeProject(dir);
    expect(report.findings.map(({ code }) => code)).toEqual(['ZD0741']);
    expect(report.findings[0]?.evidence[0]?.detail).toContain('524288 bytes');
    expect(report.exitCode).toBe(DoctorExitCode.Findings);
  });

  it('checks a provider artifact with mode A rules only', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    const report = await analyzeProject(dir);
    expect(report).toMatchObject({
      exitCode: DoctorExitCode.Healthy,
      mcp: {
        classification: 'provider-artifact',
        tools: ['quote_price'],
        descriptor: 'mcp-provider.json',
      },
    });
  });

  it('reports ZD0732 for unbuilt tools and runs package checks for a tools repo', async () => {
    const noPackage = await makeTemporaryDirectory('tools', temporaryDirectories);
    await writeFile(noPackage, 'tools/search.ts', 'export default {};');
    const noPackageReport = await analyzeProject(noPackage);
    expect(noPackageReport.findings.map(({ code }) => code).sort()).toEqual([
      'ZD0732',
      'ZD0734',
    ]);
    // Amendment 13.3: without an opted-in package.json the evidence is the tool sources.
    expect(
      noPackageReport.findings.find(({ code }) => code === 'ZD0732')?.evidence
    ).toEqual([{ path: 'tools' }]);
    expect(noPackageReport.exitCode).toBe(DoctorExitCode.Findings);

    const toolsRepo = await makeTemporaryDirectory('tools-repo', temporaryDirectories);
    await writeFile(
      toolsRepo,
      'package.json',
      JSON.stringify({
        name: 'tools-repo',
        dependencies: { '@module-federation/mcp': '0.2.0', '@rslib/core': '1.0.0' },
      })
    );
    await writeFile(toolsRepo, 'tools/quote_price.ts', 'export default {};');
    const toolsReport = await analyzeProject(toolsRepo);
    expect(toolsReport.mcp).toMatchObject({
      classification: 'tools-repo',
      descriptor: null,
      packageChecks: true,
    });
    expect(formatDoctorReport(toolsReport, 'text')).toContain('Watch mode');
    expect(toolsReport.findings.find(({ code }) => code === 'ZD0732')?.evidence).toEqual([
      { path: 'dist/mcp-provider.json' },
    ]);
    expect(toolsReport.bundlers.map(({ name }) => name)).toContain('rslib');

    await writeFile(toolsRepo, 'dist/mcp-provider.json', '{}');
    const builtReport = await analyzeProject(toolsRepo);
    expect(builtReport.findings.map(({ code }) => code)).not.toContain('ZD0732');
    expect(builtReport.mcp?.descriptor).toBe('dist/mcp-provider.json');
    // Catalog rules run on the built output, with dist/ evidence paths.
    expect(builtReport.findings).toContainEqual(
      expect.objectContaining({
        code: 'ZD0740',
        evidence: expect.arrayContaining([
          expect.objectContaining({ path: 'dist/mcp-provider.json' }),
        ]),
      })
    );

    await fs.promises.rm(path.join(toolsRepo, 'dist'), { recursive: true });
    const built = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    await fs.promises.cp(built, path.join(toolsRepo, 'dist'), { recursive: true });
    const catalog = readContractJson<{ tools: Array<{ annotations?: unknown }> }>(
      'catalog.json'
    );
    delete catalog.tools[0]!.annotations;
    await writeFile(toolsRepo, 'dist/catalog.json', JSON.stringify(catalog));
    const hintReport = await analyzeProject(toolsRepo);
    expect(hintReport.findings).toContainEqual(
      expect.objectContaining({
        code: 'ZD0731',
        evidence: [{ path: 'dist/catalog.json', detail: 'tool: quote_price' }],
      })
    );
  });

  it('keeps ZD0002 for a directory that is neither an app nor an MCP provider', async () => {
    const dir = await makeTemporaryDirectory('empty', temporaryDirectories);
    const report = await analyzeProject(dir);
    expect(report.findings[0]?.code).toBe('ZD0002');
    expect(report).not.toHaveProperty('mcp');
  });
});
