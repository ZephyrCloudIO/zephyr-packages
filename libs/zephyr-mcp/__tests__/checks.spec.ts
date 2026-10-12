import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from '@rstest/core';
import {
  checkArtifact,
  checkCatalog,
  checkRepo,
  checkToolModule,
  hasErrors,
  maskSecret,
  RULES,
  runtimeModuleProblems,
  type Finding,
} from '../src/checks';
import { sha256Hex, type CatalogManifest } from '../src/manifest';
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

const readTree = async (root: string, prefix = ''): Promise<Map<string, Uint8Array>> => {
  const files = new Map<string, Uint8Array>();
  for (const entry of await readdir(path.join(root, prefix), {
    withFileTypes: true,
  })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      for (const [file, bytes] of await readTree(root, relative)) files.set(file, bytes);
    } else {
      files.set(relative, new Uint8Array(await readFile(path.join(root, relative))));
    }
  }
  return files;
};

const codesOf = (findings: readonly Finding[]) =>
  findings.map((finding) => finding.code).sort();

let scratch = '';
beforeAll(async () => {
  scratch = await mkdtemp(path.join(os.tmpdir(), 'mcp-checks-'));
});
afterAll(async () => {
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

const makeRepo = async (name: string, files: Record<string, string>) => {
  const root = path.join(scratch, name);
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  return root;
};

const skillMd = (name: string, extra = '') =>
  `---\nname: ${name}\ndescription: Does ${name}.\nmetadata:\n  owner: team\n  contact: "#team"\n---\n# ${name}\n${extra}`;

describe('rule table', () => {
  it('pins every rule id to its contract code, severity and modes', () => {
    expect(
      Object.entries(RULES).map(
        ([rule, { code, severity, modes }]) => `${code} ${rule} ${severity} ${modes}`
      )
    ).toEqual([
      'ZD0701 repo-empty error R',
      'ZD0702 skill-unknown-entry warning R',
      'ZD0710 skill-missing-file error R',
      'ZD0711 skill-frontmatter-invalid error RA',
      'ZD0712 skill-name-invalid error RA',
      'ZD0713 skill-description-invalid error RA',
      'ZD0714 skill-metadata-invalid error RA',
      'ZD0715 skill-owner-missing error RA',
      'ZD0716 skill-link-broken error RA',
      'ZD0717 skill-too-long warning RA',
      'ZD0718 skill-secret error RA',
      'ZD0719 skill-file-too-large error RA',
      'ZD0720 evals-invalid warning R',
      'ZD0721 evals-skill-mismatch warning R',
      'ZD0730 tool-name-invalid error RA',
      'ZD0731 tool-hint-missing error RA',
      'ZD0732 tools-build-missing error R',
      'ZD0733 tool-secret error RA',
      'ZD0734 tool-name-reserved error RA',
      'ZD0735 tool-name-mismatch error R',
      'ZD0736 tool-export-invalid error R',
      'ZD0737 tool-schema-invalid error RA',
      'ZD0740 artifact-descriptor-invalid error A',
      'ZD0741 artifact-catalog-invalid error A',
      'ZD0742 artifact-path-denied error A',
      'ZD0743 catalog-name-clash error RA',
    ]);
  });
});

describe('checkRepo (contract fixtures)', () => {
  it('produces exactly the expected findings for repos/skills-broken', async () => {
    const expected = await readJson<
      Array<{ code: string; severity: string; skill: string }>
    >('repos/skills-broken.expected-findings.json');
    const findings = await checkRepo(path.join(contract, 'repos/skills-broken'));
    const key = (item: { code: string; severity: string; skill?: string }) =>
      `${item.code}|${item.severity}|${item.skill}`;
    expect(findings.map(key).sort()).toEqual(expected.map(key).sort());
    for (const finding of findings) {
      expect(finding.code).toBe(RULES[finding.rule].code);
      expect(finding.path).toMatch(/^skills\//);
      expect(finding.path).not.toContain('\\');
    }
  });

  it('masks secrets and never echoes them', async () => {
    const findings = await checkRepo(path.join(contract, 'repos/skills-broken'));
    const secret = findings.find((finding) => finding.rule === 'skill-secret');
    expect(secret?.message).toContain('api_…');
    expect(JSON.stringify(findings)).not.toContain('abcd1234efgh5678ijkl');
  });

  it('produces no findings at all for repos/skills-basic', async () => {
    expect(await checkRepo(path.join(contract, 'repos/skills-basic'))).toEqual(
      await readJson('repos/skills-basic.expected-findings.json')
    );
  });
});

describe('checkRepo', () => {
  // 13.3: only a repo that classifies as MCP gets ZD07xx findings.
  it('reports an empty skills folder, and nothing for a repo that is not MCP', async () => {
    const plain = await makeRepo('plain', {
      'README.md': '# plain',
      'package.json': '{"name":"plain"}',
      'tools/lib/helper.ts': 'export const token = "abcdefghijklmnopqrstuvwxyz";',
    });
    expect(await checkRepo(plain)).toEqual([]);

    const empty = await makeRepo('empty', { 'skills/.keep': '' });
    expect((await checkRepo(empty)).map((item) => `${item.code} ${item.path}`)).toEqual([
      'ZD0701 skills',
    ]);
    await mkdir(path.join(empty, 'skills/draft'));
    expect(codesOf(await checkRepo(empty))).toEqual(['ZD0701', 'ZD0710']);
  });

  it('reports nothing for a package without skills/ or tool files', async () => {
    const root = await makeRepo('plain-package', {
      'package.json': JSON.stringify({ name: 'web-app', version: '1.0.0' }),
      'src/index.ts': 'export const answer = 42;',
      'src/skills.ts': 'export const skills = [];',
    });
    expect(await checkRepo(root)).toEqual([]);
  });

  it('checks tool files and the build setup', async () => {
    const root = await makeRepo('tools', {
      'tools/ok_tool.ts': 'export default {};',
      'tools/search.ts': 'export default {};',
      'tools/bad.name.ts': 'export default {};',
      'tools/lib/shared.ts': 'export const token = "abcdefghijklmnopqrstuvwxyz";',
      'tools/_private.ts': '',
      'tools/x.d.ts': '',
      'tools/x.test.ts': '',
    });
    const findings = await checkRepo(root);
    expect(findings.map((finding) => `${finding.code} ${finding.path}`)).toEqual([
      'ZD0732 tools',
      'ZD0730 tools/bad.name.ts',
      'ZD0733 tools/lib/shared.ts',
      'ZD0734 tools/search.ts',
    ]);
    expect(findings.find((finding) => finding.code === 'ZD0732')?.message).toMatch(
      /package\.json/
    );

    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'tools', dependencies: { zod: '*' } })
    );
    expect(
      (await checkRepo(root)).find((finding) => finding.code === 'ZD0732')?.message
    ).toMatch(/must depend on zephyr-mcp/);
    // The preset running is proof of opt-in.
    expect(
      (await checkRepo(root, { building: true })).some(
        (finding) => finding.code === 'ZD0732'
      )
    ).toBe(false);
    // A zephyr.config opts in only with a literal `mcp: true`, read
    // statically like ze-cli doctor; comments do not count.
    const optIn = async (file: string, source: string) => {
      await writeFile(path.join(root, file), source);
      const message = (await checkRepo(root)).find(
        (finding) => finding.code === 'ZD0732'
      )?.message;
      await rm(path.join(root, file));
      return message;
    };
    for (const file of ['zephyr.config.ts', 'zephyr.config.mjs']) {
      expect(await optIn(file, 'export default { mcp: true };')).toMatch(
        /dist\/mcp-provider\.json is missing/
      );
    }
    expect(await optIn('zephyr.config.cjs', "module.exports = { 'mcp': true }")).toMatch(
      /dist\/mcp-provider\.json is missing/
    );
    // A config without it, one that only mentions it in a comment, and a
    // JSON config (zephyr-agent loads none) leave the repo un-opted.
    expect(
      await optIn('zephyr.config.ts', "export default { appName: 'tools' };")
    ).toMatch(/must depend on zephyr-mcp/);
    expect(
      await optIn(
        'zephyr.config.ts',
        '// mcp: true\n/* mcp: true */\nexport default { mcp: false };'
      )
    ).toMatch(/must depend on zephyr-mcp/);
    expect(await optIn('zephyr.config.json', JSON.stringify({ mcp: true }))).toMatch(
      /must depend on zephyr-mcp/
    );

    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'tools',
        devDependencies: { 'zephyr-mcp': '*' },
      })
    );
    const missing = (await checkRepo(root)).find((finding) => finding.code === 'ZD0732');
    expect(missing?.message).toMatch(/dist\/mcp-provider\.json is missing/);
    // 13.3: the evidence is the missing descriptor once the repo opts in.
    expect(missing?.path).toBe('dist/mcp-provider.json');
    expect(
      (await checkRepo(root, { building: true })).some(
        (finding) => finding.code === 'ZD0732'
      )
    ).toBe(false);
  });

  it('reports symlinks, unknown entries, evals mismatches and long skills', async () => {
    const root = await makeRepo('skills', {
      'skills/linked/SKILL.md': skillMd('linked'),
      'skills/linked/references/real.md': 'real',
      'skills/linked/Notes/x.md': 'unknown folder',
      'skills/linked/.DS_Store': 'ignored',
      'skills/linked/evals/evals.json': JSON.stringify({
        skill_name: 'other',
        evals: [{ id: 1, prompt: 'p' }],
      }),
      'skills/long/SKILL.md': skillMd('long', 'line\n'.repeat(501)),
      'skills/shape/SKILL.md': skillMd('shape'),
      'skills/shape/EVALS/evals.json': JSON.stringify({
        skill_name: 'shape',
        evals: [{ id: 1 }],
      }),
    });
    await symlink(
      path.join(root, 'skills/linked/references/real.md'),
      path.join(root, 'skills/linked/references/link.md')
    );
    await symlink(path.join(root, 'skills/linked'), path.join(root, 'skills/alias'));
    const findings = await checkRepo(root);
    expect(findings.map((finding) => `${finding.code} ${finding.path}`)).toEqual([
      'ZD0702 skills/alias',
      'ZD0702 skills/linked/Notes',
      'ZD0721 skills/linked/evals/evals.json',
      'ZD0702 skills/linked/references/link.md',
      'ZD0717 skills/long/SKILL.md',
      'ZD0720 skills/shape/EVALS/evals.json',
    ]);
    expect(hasErrors(findings)).toBe(false);
  });

  it('reports links to evals, to folders and with fragments correctly', async () => {
    const root = await makeRepo('links', {
      'skills/links/SKILL.md': skillMd(
        'links',
        [
          '[ok](references/a.md#part) [dir](references/) ![img](<assets/my logo.png>)',
          '[web](https://example.com) [anchor](#top) [mail](mailto:a@b.c) [abs](/x.md)',
          '[evals](evals/evals.json)',
          '`[code](nope.md)`',
          '```',
          '[fenced](nope.md)',
          '```',
          '[ref]: ./references/missing.md',
        ].join('\n')
      ),
      'skills/links/references/a.md': 'a',
      'skills/links/assets/my logo.png': 'png',
      'skills/links/evals/evals.json': JSON.stringify({
        skill_name: 'links',
        evals: [],
      }),
    });
    const findings = await checkRepo(root);
    // By line, never quoting the target: messages carry no file contents.
    // A folder is not a served file, even with served files under it (line
    // 9, like ze-cli).
    expect(findings.map((finding) => finding.message)).toEqual([
      expect.stringMatching(/^a link on line 11 points at a file that is not served/),
      expect.stringMatching(/^a link on line 16 points at a file that is not served/),
      expect.stringMatching(/^a link on line 9 points at a file that is not served/),
    ]);
    expect(JSON.stringify(findings)).not.toMatch(/missing\.md|evals\.json"/);
  });

  it('never quotes frontmatter values and counts a description by length', async () => {
    const root = await makeRepo('values', {
      'skills/folder/SKILL.md':
        '---\nname: Secret-Name\ndescription: x\nmetadata: {owner: a, contact: b}\n---\n',
      // Whitespace is 3 characters: valid by the contract's 1-1,024 rule.
      'skills/spaces/SKILL.md':
        '---\nname: spaces\ndescription: "   "\nmetadata: {owner: a, contact: b}\n---\n',
    });
    const findings = await checkRepo(root);
    expect(findings.map((finding) => `${finding.code} ${finding.skill}`)).toEqual([
      'ZD0712 folder',
    ]);
    expect(JSON.stringify(findings)).not.toContain('Secret-Name');
  });

  it('checks frontmatter one finding per rule', async () => {
    const root = await makeRepo('frontmatter', {
      'skills/folder/SKILL.md':
        '---\nname: other\ndescription: x\ncompatibility: 1\nmetadata:\n  owner: 1\n  contact: c\n---\n',
      'skills/yaml/SKILL.md': '---\nname: [unclosed\n---\n',
      'skills/list/SKILL.md': '---\n- a\n---\n',
      'skills/evals/SKILL.md':
        '---\nname: evals\ndescription: x\nmetadata: {owner: a, contact: b}\n---\n',
    });
    const findings = await checkRepo(root);
    expect(findings.map((finding) => `${finding.code} ${finding.skill}`)).toEqual([
      'ZD0712 evals',
      'ZD0712 folder',
      'ZD0714 folder',
      'ZD0711 list',
      'ZD0711 yaml',
    ]);
  });

  it('requires SKILL.md to start with exactly "---", so a BOM is ZD0711', async () => {
    const root = await makeRepo('bom', {
      'skills/bom/SKILL.md': String.fromCharCode(0xfeff) + skillMd('bom'),
      'skills/crlf/SKILL.md': skillMd('crlf').replace(/\n/g, '\r\n'),
    });
    expect(
      (await checkRepo(root)).map((finding) => `${finding.code} ${finding.skill}`)
    ).toEqual(['ZD0711 bom']);
  });

  it('scans every UTF-8 skill file for secrets, whatever its extension', async () => {
    // Built at runtime so no secret-shaped literal lives in the source.
    const header = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
    const root = await makeRepo('secret-ext', {
      'skills/keys/SKILL.md': skillMd('keys'),
      'skills/keys/assets/deploy.pem': `${header}\nnot-a-real-key\n`,
      'skills/keys/references/setup.ini': 'harmless = true\n',
    });
    const findings = await checkRepo(root);
    expect(findings.map((finding) => `${finding.code} ${finding.path}`)).toEqual([
      'ZD0718 skills/keys/assets/deploy.pem',
    ]);
    expect(findings[0]?.message).toContain('----…');
    expect(JSON.stringify(findings)).not.toContain('PRIVATE KEY');
  });

  // Contract 11.8: files that are not valid UTF-8 are scanned as latin1.
  it('scans skill files and tool sources that are not UTF-8 as latin1', async () => {
    const key = ['AKIA', 'A'.repeat(16)].join('');
    const binary = (text: string) =>
      Buffer.concat([
        Buffer.from([0xff, 0xfe, 0x00]),
        Buffer.from(`\n${text}\n`, 'latin1'),
      ]);
    const root = await makeRepo('secret-latin1', {
      'package.json': JSON.stringify({
        name: 'x',
        dependencies: { 'zephyr-mcp': '*' },
      }),
      'skills/keys/SKILL.md': skillMd('keys'),
    });
    await mkdir(path.join(root, 'skills/keys/assets'), { recursive: true });
    await writeFile(
      path.join(root, 'skills/keys/assets/blob.bin'),
      binary(`caf\u00e9 ${key}`)
    );
    await mkdir(path.join(root, 'tools'), { recursive: true });
    await writeFile(path.join(root, 'tools/leak.ts'), binary(key));
    const findings = await checkRepo(root, { building: true });
    expect(findings.map((finding) => `${finding.code} ${finding.path}`)).toEqual([
      'ZD0718 skills/keys/assets/blob.bin',
      'ZD0733 tools/leak.ts',
    ]);
    expect(findings[0]?.message).toMatch(/^line 2 looks like a secret \(AKIA…\)/);
    expect(JSON.stringify(findings)).not.toContain(key);
  });

  // Contract 11.1 (SEP-2640): 512 files, 16 MiB in total, 5 MiB per file.
  it('limits a skill to 512 files, 16 MiB in total and 5 MiB per file', async () => {
    const files: Record<string, string> = {
      'skills/many/SKILL.md': skillMd('many'),
      'skills/fits/SKILL.md': skillMd('fits'),
    };
    for (let index = 0; index < 512; index += 1) {
      files[`skills/many/references/${index}.md`] = 'x';
    }
    for (let index = 0; index < 511; index += 1) {
      files[`skills/fits/references/${index}.md`] = 'x';
    }
    const root = await makeRepo('limits', files);
    // 4 files of 4 MiB: each under 5 MiB, together over 16 MiB.
    const fourMiB = Buffer.alloc(4 * 1024 * 1024, 0x61);
    for (let index = 0; index < 4; index += 1) {
      await mkdir(path.join(root, 'skills/big/assets'), { recursive: true });
      await writeFile(path.join(root, `skills/big/assets/${index}.bin`), fourMiB);
    }
    await writeFile(path.join(root, 'skills/big/SKILL.md'), skillMd('big'));
    await mkdir(path.join(root, 'skills/huge/assets'), { recursive: true });
    await writeFile(path.join(root, 'skills/huge/SKILL.md'), skillMd('huge'));
    await writeFile(
      path.join(root, 'skills/huge/assets/one.bin'),
      Buffer.alloc(5 * 1024 * 1024 + 1)
    );
    const findings = (await checkRepo(root)).filter(
      (finding) => finding.code !== 'ZD0702'
    );
    expect(findings.map((finding) => `${finding.code} ${finding.path}`)).toEqual([
      'ZD0719 skills/big',
      'ZD0719 skills/huge/assets/one.bin',
      'ZD0719 skills/many',
    ]);
    expect(findings[0]?.message).toMatch(/16 MiB/);
    expect(findings[2]?.message).toMatch(/513 files; the limit is 512/);
  }, 60_000);

  it('reads links from the SKILL.md body only, at file line numbers', async () => {
    const root = await makeRepo('frontmatter-links', {
      'skills/fm/SKILL.md': [
        '---',
        'name: fm',
        "description: '[a](missing.md) and ![b](../outside.png)'",
        'metadata:',
        '  owner: team',
        '  contact: "[c](nope.md)"',
        '---',
        '# fm',
        '[broken](references/missing.md)',
      ].join('\n'),
    });
    const findings = await checkRepo(root);
    expect(findings.map((finding) => finding.message)).toEqual([
      expect.stringMatching(/^a link on line 9 points at a file that is not served/),
    ]);
  });
});

describe('checkCatalog', () => {
  it('passes the valid catalog with its descriptor', async () => {
    expect(
      checkCatalog(await readJson('catalog.json'), await readJson('mcp-provider.json'))
    ).toEqual([]);
  });

  it('reports the rule each invalid catalog breaks', async () => {
    const expected: Record<string, string> = {
      'catalog-invalid-evals-path.json': 'ZD0742',
      'catalog-invalid-flags.json': 'ZD0741',
      'catalog-invalid-mime.json': 'ZD0741',
      'catalog-invalid-reserved-tool.json': 'ZD0734',
      'catalog-invalid-runtime-modules.json': 'ZD0741',
      'catalog-invalid-runtime-without-tools.json': 'ZD0741',
      'catalog-invalid-sha256-uppercase.json': 'ZD0741',
      'catalog-invalid-skill-path.json': 'ZD0741',
      'catalog-invalid-tool-schema-root.json': 'ZD0737',
    };
    for (const [file, code] of Object.entries(expected)) {
      expect({
        file,
        codes: codesOf(checkCatalog(await readJson(file))),
      }).toEqual({
        file,
        codes: [code],
      });
    }
  });

  it('reports deploy policies, the descriptor and shape problems', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    delete catalog.tools[0]?.annotations;
    delete catalog.skills[0]?.frontmatter.metadata;
    const findings = checkCatalog(catalog, { manifestVersion: 1, name: 'x' });
    expect(codesOf(findings)).toEqual(['ZD0715', 'ZD0731', 'ZD0740', 'ZD0740']);
    expect(findings.find((finding) => finding.code === 'ZD0731')?.tool).toBe(
      'quote_price'
    );
    expect(findings.find((finding) => finding.code === 'ZD0715')?.skill).toBe(
      'quote-a-deal'
    );

    expect(codesOf(checkCatalog({ manifestVersion: 2 }))).toEqual(
      expect.arrayContaining(['ZD0741']) as never
    );
    expect(codesOf(checkCatalog('{'))).toEqual(['ZD0741']);
  });

  it('limits a skill to 512 files and 16 MiB in total', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const skill = catalog.skills[0];
    const file = skill?.files.find((entry) => entry.path !== 'SKILL.md');
    if (!skill || !file) throw new Error('fixture changed');
    const original = structuredClone(skill.files);
    // 512 files in total is the limit, 513 is over it.
    const fill = (count: number, size: number) => {
      skill.files = [
        ...original,
        ...Array.from({ length: count - original.length }, (_, index) => ({
          ...file,
          path: `references/extra-${index}.md`,
          mimeType: 'text/markdown',
          size,
        })),
      ];
    };
    fill(512, 1);
    expect(checkCatalog(catalog)).toEqual([]);
    fill(513, 1);
    expect(
      checkCatalog(catalog).map((finding) => `${finding.code} ${finding.message}`)
    ).toEqual(['ZD0719 skills/0/files: more than 512 files']);
    // 4 files of 4 MiB plus the originals: each under 5 MiB, over 16 MiB.
    fill(original.length + 4, 4 * 1024 * 1024);
    expect(
      checkCatalog(catalog).map((finding) => `${finding.code} ${finding.message}`)
    ).toEqual(['ZD0719 skills/0/files: files total more than 16 MiB']);
  });

  // The Zephyr MCP loads a provider only within [2025-11-17, its own date].
  it('rejects a compatibility date before 2025-11-17', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const runtime = catalog.runtime;
    if (!runtime) throw new Error('fixture changed');
    for (const [date, codes] of [
      ['2025-11-17', []],
      ['2025-11-16', ['ZD0741']],
      ['2020-01-01', ['ZD0741']],
    ] as const) {
      runtime.compatibilityDate = date;
      expect({ date, codes: codesOf(checkCatalog(catalog)) }).toEqual({
        date,
        codes,
      });
    }
  });

  it('reports a provider that differs from its descriptor', async () => {
    const descriptor = await readJson<Record<string, unknown>>('mcp-provider.json');
    expect(
      codesOf(
        checkCatalog(await readJson('catalog.json'), {
          ...descriptor,
          version: '2.0.0',
        })
      )
    ).toEqual(['ZD0741']);
  });
});

describe('checkArtifact', () => {
  it('passes the fixture artifact artifacts/tools-basic', async () => {
    const files = await readTree(path.join(contract, 'artifacts/tools-basic'));
    expect(await checkArtifact(files)).toEqual([]);
  });

  it('reports extra, denied, missing and changed files', async () => {
    const files = await readTree(path.join(contract, 'artifacts/tools-basic'));
    files.set('notes.txt', new Uint8Array([1]));
    files.set('skills/quote-a-deal/evals/evals.json', new Uint8Array([1]));
    files.set('tools/quote_price.ts', new Uint8Array([1]));
    files.set('tools/index.js.map', new Uint8Array([1]));
    files.delete('skills/quote-a-deal/references/apple.md');
    files.set('skills/release-a-frontend/SKILL.md', new Uint8Array([1, 2, 3]));
    const findings = await checkArtifact(files);
    expect(findings.map((finding) => `${finding.code} ${finding.path}`)).toEqual([
      'ZD0741 notes.txt',
      'ZD0742 skills/quote-a-deal/evals/evals.json',
      'ZD0741 skills/quote-a-deal/references/apple.md',
      // The changed SKILL.md: wrong digest, and no frontmatter block.
      'ZD0711 skills/release-a-frontend/SKILL.md',
      'ZD0741 skills/release-a-frontend/SKILL.md',
      'ZD0742 tools/index.js.map',
      'ZD0742 tools/quote_price.ts',
    ]);
    files.delete('skills/quote-a-deal/evals/evals.json');
    files.delete('tools/quote_price.ts');
    files.delete('tools/index.js.map');
    expect(
      (await checkArtifact(files, { extraFiles: 'ignore' })).map(
        (finding) => finding.path
      )
    ).toEqual([
      'skills/quote-a-deal/references/apple.md',
      'skills/release-a-frontend/SKILL.md',
      'skills/release-a-frontend/SKILL.md',
    ]);
  });

  it('scans a runtime module that is not UTF-8 for secrets as latin1', async () => {
    const files = await readTree(path.join(contract, 'artifacts/tools-basic'));
    const key = ['AKIA', 'B'.repeat(16)].join('');
    files.set(
      'tools/index.js',
      new Uint8Array([0xff, 0x0a, ...new TextEncoder().encode(key)])
    );
    const findings = await checkArtifact(files);
    expect(
      findings
        .filter((finding) => finding.path === 'tools/index.js')
        .map((finding) => `${finding.code} ${finding.message}`)
    ).toEqual(
      expect.arrayContaining([
        'ZD0741 the runtime module is not UTF-8',
        'ZD0733 line 2 looks like a secret (AKIA…); remove it and rotate it',
      ]) as never
    );
    expect(JSON.stringify(findings)).not.toContain(key);
  });

  it('reports a missing descriptor and catalog', async () => {
    expect(codesOf(await checkArtifact({}))).toEqual(['ZD0740', 'ZD0741']);
  });

  it('reports a SKILL.md whose frontmatter differs from the catalog', async () => {
    const files = await readTree(path.join(contract, 'artifacts/tools-basic'));
    const skillPath = 'skills/release-a-frontend/SKILL.md';
    const original = new TextDecoder().decode(files.get(skillPath));
    const bytes = new TextEncoder().encode(
      original.replace(/^description: .*$/m, 'description: Something else.')
    );
    files.set(skillPath, bytes);
    // Digests match; only the served frontmatter disagrees with the catalog.
    const catalog = JSON.parse(
      new TextDecoder().decode(files.get('catalog.json'))
    ) as CatalogManifest;
    const listed = catalog.skills
      .find((skill) => skill.name === 'release-a-frontend')
      ?.files.find((file) => file.path === 'SKILL.md');
    if (!listed) throw new Error('fixture changed');
    listed.size = bytes.byteLength;
    listed.sha256 = await sha256Hex(bytes);
    files.set('catalog.json', new TextEncoder().encode(JSON.stringify(catalog)));
    expect(
      (await checkArtifact(files)).map((finding) => `${finding.code} ${finding.path}`)
    ).toEqual([`ZD0741 ${skillPath}`]);
  });

  // zephyr-agent, ze-cli, the edge and the Zephyr MCP deny *.map and
  // TypeScript sources under tools/ in any case.
  it('denies *.map and tools/*.ts in any case', async () => {
    const files = await readTree(path.join(contract, 'artifacts/tools-basic'));
    files.set('tools/index.js.map', new Uint8Array([1]));
    files.set('tools/Quote.TS', new Uint8Array([1]));
    files.set('skills/release-a-frontend/references/notes.MAP', new Uint8Array([1]));
    expect(
      (await checkArtifact(files)).map((finding) => `${finding.code} ${finding.path}`)
    ).toEqual([
      'ZD0742 skills/release-a-frontend/references/notes.MAP',
      'ZD0742 tools/Quote.TS',
      'ZD0742 tools/index.js.map',
    ]);
  });

  it('reports a SKILL.md without frontmatter even when its digest matches (ZD0711)', async () => {
    const files = await readTree(path.join(contract, 'artifacts/tools-basic'));
    const skillPath = 'skills/release-a-frontend/SKILL.md';
    const bytes = new TextEncoder().encode('# No frontmatter\n');
    files.set(skillPath, bytes);
    // Keep the catalog consistent so only the file's content is wrong.
    const catalog = JSON.parse(
      new TextDecoder().decode(files.get('catalog.json'))
    ) as CatalogManifest;
    const listed = catalog.skills
      .find((skill) => skill.name === 'release-a-frontend')
      ?.files.find((file) => file.path === 'SKILL.md');
    if (!listed) throw new Error('fixture changed');
    listed.size = bytes.byteLength;
    listed.sha256 = await sha256Hex(bytes);
    files.set('catalog.json', new TextEncoder().encode(JSON.stringify(catalog)));
    expect(
      (await checkArtifact(files)).map((finding) => `${finding.code} ${finding.path}`)
    ).toEqual([`ZD0711 ${skillPath}`]);
  });
});

describe('runtimeModuleProblems', () => {
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
    expect(runtimeModuleProblems(source).join(' ')).toContain(problem);
  });

  it.each([
    ['/**/import {connect} from "\\x63loudflare:sockets"; export default {}'],
    ['a()/* x */;import/* y */{b}/* z */from/**/"y"'],
    ['const k = 1; // note\nimport x from "y"'],
    ['export/**/*/**/from"y"'],
    ['const m = import/**/("y")'],
  ])('sees through comments and escapes: %s', (source) => {
    expect(runtimeModuleProblems(source)).not.toEqual([]);
  });

  it('accepts a self-contained module', () => {
    expect(
      runtimeModuleProblems(
        'const important = import.meta.url; const x = { imports: 1 };\nexport { x as default };'
      )
    ).toEqual([]);
    // The word in a string or a property is not an import.
    expect(
      runtimeModuleProblems(
        'const kind = "import"; const c = { import: "esm" }; a.import("x");\nexport { c as default };'
      )
    ).toEqual([]);
  });
});

describe('checkToolModule', () => {
  const handler = () => undefined;
  it('reports exports, names and schemas', () => {
    expect(
      checkToolModule({
        file: 'tools/a.ts',
        name: 'a',
        exported: undefined,
      }).findings.map((finding) => finding.code)
    ).toEqual(['ZD0736']);
    expect(
      checkToolModule({
        file: 'tools/a.ts',
        name: 'a',
        exported: { name: 'b', description: 'x', handler },
      }).findings.map((finding) => finding.code)
    ).toEqual(['ZD0735']);
    expect(
      checkToolModule({
        file: 'tools/a.ts',
        name: 'a',
        exported: { description: 'x' },
      }).findings.map((finding) => finding.code)
    ).toEqual(['ZD0736']);
    expect(
      checkToolModule({
        file: 'tools/a.ts',
        name: 'a',
        exported: { description: 'x', inputSchema: { type: 'array' }, handler },
      }).findings.map((finding) => finding.code)
    ).toEqual(['ZD0737']);
    expect(
      checkToolModule({
        file: 'tools/a.ts',
        name: 'a',
        exported: { description: 'x', handler },
      })
    ).toEqual({
      findings: [],
      tool: { name: 'a', description: 'x', inputSchema: { type: 'object' } },
    });
  });
});

describe('maskSecret', () => {
  it('shows the first 4 characters', () => {
    expect(maskSecret('AKIAABCDEFGHIJKLMNOP')).toBe('AKIA…');
  });
});

// Contract amendments v2.2 (section 12), as every validator applies them.
describe('contract 12 amendments', () => {
  const loadArtifact = () => readTree(path.join(contract, 'artifacts/tools-basic'));
  const readCatalog = (files: Map<string, Uint8Array>) =>
    JSON.parse(new TextDecoder().decode(files.get('catalog.json'))) as CatalogManifest;
  const writeCatalog = (files: Map<string, Uint8Array>, catalog: CatalogManifest) =>
    files.set('catalog.json', new TextEncoder().encode(JSON.stringify(catalog)));
  // Replaces a listed skill file and keeps its catalog entry consistent, so
  // only the file's content is in question.
  const replaceSkillFile = async (
    files: Map<string, Uint8Array>,
    skillName: string,
    filePath: string,
    text: string,
    edit: (catalog: CatalogManifest) => void = () => {}
  ) => {
    const bytes = new TextEncoder().encode(text);
    files.set(`skills/${skillName}/${filePath}`, bytes);
    const catalog = readCatalog(files);
    const listed = catalog.skills
      .find((skill) => skill.name === skillName)
      ?.files.find((file) => file.path === filePath);
    if (!listed) throw new Error('fixture changed');
    listed.size = bytes.byteLength;
    listed.sha256 = await sha256Hex(bytes);
    edit(catalog);
    writeCatalog(files, catalog);
  };
  const pathsOf = (findings: readonly Finding[]) =>
    findings.map((item) => `${item.code} ${item.path}`);

  // 12.4: producers drop `$schema` and inline a root `$ref`.
  it.each([
    ['inputSchema', '$schema'],
    ['inputSchema', '$ref'],
    ['outputSchema', '$schema'],
    ['outputSchema', '$ref'],
  ] as const)('reports a catalog %s with a root %s as ZD0737', async (key, keyword) => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const tool = catalog.tools[0];
    if (!tool) throw new Error('fixture changed');
    tool[key] = {
      type: 'object',
      [keyword]:
        keyword === '$ref'
          ? '#/$defs/Input'
          : 'https://json-schema.org/draft/2020-12/schema',
      $defs: { Input: { type: 'object' } },
    };
    const findings = checkCatalog(catalog);
    expect(codesOf(findings)).toEqual(['ZD0737']);
    expect(findings[0]?.tool).toBe(tool.name);

    const files = await loadArtifact();
    writeCatalog(files, catalog);
    expect(codesOf(await checkArtifact(files))).toEqual(['ZD0737']);
  });

  it('allows $ref and $schema below the schema root', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const tool = catalog.tools[0];
    if (!tool) throw new Error('fixture changed');
    tool.inputSchema = {
      type: 'object',
      properties: { node: { $ref: '#/$defs/Node' } },
      $defs: { Node: { type: 'object', $schema: 'nested is data' } },
    };
    expect(checkCatalog(catalog)).toEqual([]);
  });

  // 12.3: frontmatter field rules keep their specific codes in A mode.
  it.each([
    ['name', 'Not_A_Name', 'ZD0712'],
    ['description', 'd'.repeat(1025), 'ZD0713'],
    ['compatibility', 'c'.repeat(501), 'ZD0714'],
    ['metadata', { owner: 'a', contact: 'b', level: 3 }, 'ZD0714'],
    ['license', 1, 'ZD0714'],
    ['allowed-tools', ['a', 'b'], 'ZD0714'],
  ] as const)(
    'reports catalog frontmatter %s with its own code',
    async (key, value, code) => {
      const catalog = await readJson<CatalogManifest>('catalog.json');
      const skill = catalog.skills[0];
      if (!skill) throw new Error('fixture changed');
      (skill.frontmatter as Record<string, unknown>)[key] = value;
      expect(codesOf(checkCatalog(catalog))).toEqual([code]);
    }
  );

  it('reports a license that is not a string as ZD0714 in an artifact', async () => {
    const files = await loadArtifact();
    const original = new TextDecoder().decode(
      files.get('skills/release-a-frontend/SKILL.md')
    );
    // Both sides agree, so only the field type is wrong.
    await replaceSkillFile(
      files,
      'release-a-frontend',
      'SKILL.md',
      original.replace('license: MIT', 'license: 2'),
      (catalog) => {
        const skill = catalog.skills.find((item) => item.name === 'release-a-frontend');
        if (skill) (skill.frontmatter as Record<string, unknown>).license = 2;
      }
    );
    expect(pathsOf(await checkArtifact(files))).toEqual(['ZD0714 catalog.json']);
  });

  it('keeps ZD0742 to its list; other unsafe and unserved paths are ZD0741', async () => {
    const base = await readJson<CatalogManifest>('catalog.json');
    const variants: Array<[string, string]> = [
      ['references//a.md', 'ZD0741'],
      ['references\\a.md', 'ZD0741'],
      ['references/node_modules/a.md', 'ZD0741'],
      ['notes/a.md', 'ZD0741'],
      ['references/../a.md', 'ZD0742'],
      ['references/.hidden.md', 'ZD0742'],
      ['references/evals/a.md', 'ZD0742'],
      ['references/a.md.map', 'ZD0742'],
    ];
    for (const [filePath, code] of variants) {
      const catalog = structuredClone(base);
      const file = catalog.skills[0]?.files.find(
        (entry) => entry.path === 'references/apple.md'
      );
      if (!file) throw new Error('fixture changed');
      file.path = filePath;
      expect({ filePath, codes: codesOf(checkCatalog(catalog)) }).toEqual({
        filePath,
        codes: [code],
      });
    }

    const files = await loadArtifact();
    files.set('skills/quote-a-deal//a.md', new Uint8Array([1]));
    files.set('skills/quote-a-deal/references/node_modules/a.md', new Uint8Array([1]));
    files.set('skills/quote-a-deal/.env', new Uint8Array([1]));
    expect(pathsOf(await checkArtifact(files))).toEqual([
      'ZD0742 skills/quote-a-deal/.env',
      'ZD0741 skills/quote-a-deal//a.md',
      'ZD0741 skills/quote-a-deal/references/node_modules/a.md',
    ]);
  });

  // 12.7: a link must resolve to a served file; a folder never does.
  it('reports a link to a folder of served files as ZD0716 in an artifact', async () => {
    for (const target of ['references/', 'references', './references/.']) {
      const files = await loadArtifact();
      const original = new TextDecoder().decode(
        files.get('skills/quote-a-deal/SKILL.md')
      );
      await replaceSkillFile(
        files,
        'quote-a-deal',
        'SKILL.md',
        `${original}\nSee [the references](${target}).\n`
      );
      expect({ target, found: pathsOf(await checkArtifact(files)) }).toEqual({
        target,
        found: ['ZD0716 skills/quote-a-deal/SKILL.md'],
      });
    }
  });

  it('reports a link to a folder of served files as ZD0716 in a repo', async () => {
    const root = await makeRepo('folder-links', {
      'skills/folders/SKILL.md': skillMd(
        'folders',
        '[a](references) [b](./references/sub) [c](references/sub/a.md)\n'
      ),
      'skills/folders/references/sub/a.md': 'a',
    });
    const findings = await checkRepo(root);
    expect(pathsOf(findings)).toEqual([
      'ZD0716 skills/folders/SKILL.md',
      'ZD0716 skills/folders/SKILL.md',
    ]);
  });

  // 12.6: ZD0702 applies alongside ZD0710.
  it('reports unknown entries in a skill folder without SKILL.md', async () => {
    const root = await makeRepo('no-skill-file', {
      'skills/orphan/notes.txt': 'not served',
      'skills/orphan/references/a.md': 'a',
      'skills/kept/SKILL.md': skillMd('kept'),
    });
    const findings = await checkRepo(root);
    expect(pathsOf(findings)).toEqual([
      'ZD0710 skills/orphan',
      'ZD0702 skills/orphan/notes.txt',
    ]);
    expect(findings.map((item) => item.skill)).toEqual(['orphan', 'orphan']);
  });

  // 12.8: impossible calendar dates are invalid.
  it.each([
    ['2026-02-31', ['ZD0741']],
    ['2026-04-31', ['ZD0741']],
    ['2027-02-29', ['ZD0741']],
    ['2028-02-29', []],
  ] as const)('checks compatibilityDate %s as a calendar date', async (date, codes) => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    if (!catalog.runtime) throw new Error('fixture changed');
    catalog.runtime.compatibilityDate = date;
    expect(codesOf(checkCatalog(catalog))).toEqual(codes);
  });

  // 12.2: runtime self-containment, invalid UTF-8 included.
  it.each([
    ['import x from "y"; export default {};', 'static import'],
    ['export * from "y";', 're-exports'],
    ['export default { f: () => import("y") };', 'dynamic import()'],
    ['export default { s: "node:fs" };', 'node:* or cloudflare:*'],
    ['export default { s: "cloudflare:sockets" };', 'node:* or cloudflare:*'],
  ])(
    'reports a runtime module that is not self-contained: %s',
    async (source, problem) => {
      const files = await loadArtifact();
      const bytes = new TextEncoder().encode(source);
      files.set('tools/index.js', bytes);
      const catalog = readCatalog(files);
      const module = catalog.runtime?.modules[0];
      if (!module) throw new Error('fixture changed');
      module.size = bytes.byteLength;
      module.sha256 = await sha256Hex(bytes);
      writeCatalog(files, catalog);
      const findings = await checkArtifact(files);
      expect(pathsOf(findings)).toEqual(['ZD0741 tools/index.js']);
      expect(findings[0]?.message).toContain(problem);
    }
  );

  it('reports a runtime module that is not UTF-8 at tools/index.js', async () => {
    const files = await loadArtifact();
    const bytes = new Uint8Array([0x65, 0x78, 0xc3, 0x28, 0x0a]);
    files.set('tools/index.js', bytes);
    const catalog = readCatalog(files);
    const module = catalog.runtime?.modules[0];
    if (!module) throw new Error('fixture changed');
    module.size = bytes.byteLength;
    module.sha256 = await sha256Hex(bytes);
    writeCatalog(files, catalog);
    expect(
      (await checkArtifact(files)).map(
        (item) => `${item.code} ${item.path} ${item.message}`
      )
    ).toEqual(['ZD0741 tools/index.js the runtime module is not UTF-8']);
  });
});

// Contract amendments v2.3 (section 13).
describe('contract 13 amendments', () => {
  const loadArtifact = () => readTree(path.join(contract, 'artifacts/tools-basic'));
  const pathsOf = (findings: readonly Finding[]) =>
    findings.map((item) => `${item.code} ${item.path}`);
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

  // 13.2: a missing or non-object schema is ZD0737, never a shape error.
  it.each([
    ['inputSchema', undefined],
    ['inputSchema', null],
    ['inputSchema', 'object'],
    ['inputSchema', [{ type: 'object' }]],
    ['outputSchema', null],
    ['outputSchema', 1],
    ['outputSchema', []],
  ] as const)('reports a tool %s of %j as ZD0737', async (key, value) => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const tool = catalog.tools[0] as Record<string, unknown> | undefined;
    if (!tool) throw new Error('fixture changed');
    if (value === undefined) delete tool[key];
    else tool[key] = value;
    const findings = checkCatalog(catalog);
    expect(pathsOf(findings)).toEqual(['ZD0737 catalog.json']);
    expect(findings[0]?.message).toContain(`tools/0/${key}`);
    expect(findings[0]?.tool).toBe('quote_price');

    const files = await loadArtifact();
    files.set('catalog.json', encode(catalog));
    expect(pathsOf(await checkArtifact(files))).toEqual(['ZD0737 catalog.json']);
  });

  it('still accepts a tool without an outputSchema', async () => {
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const tool = catalog.tools[0];
    if (!tool) throw new Error('fixture changed');
    delete tool.outputSchema;
    expect(checkCatalog(catalog)).toEqual([]);
  });

  // 13.2: an invalid descriptor is ZD0740 alone; the catalog's provider is
  // not length-checked against it.
  it('reports only ZD0740 for an invalid descriptor', async () => {
    const descriptor = await readJson<Record<string, unknown>>('mcp-provider.json');
    const catalog = await readJson<CatalogManifest>('catalog.json');
    const long = '1'.repeat(300);
    catalog.provider.version = long;
    const findings = checkCatalog(catalog, { ...descriptor, version: long });
    expect(pathsOf(findings)).toEqual(['ZD0740 mcp-provider.json']);

    catalog.provider.name = 'Not A Name';
    expect(codesOf(checkCatalog(catalog, { ...descriptor, name: 'Not A Name' }))).toEqual(
      ['ZD0740']
    );

    const files = await loadArtifact();
    files.set('catalog.json', encode(catalog));
    files.set(
      'mcp-provider.json',
      encode({ ...descriptor, name: 'Not A Name', version: long })
    );
    expect(codesOf(await checkArtifact(files))).toEqual(['ZD0740', 'ZD0740']);
    files.set('mcp-provider.json', new TextEncoder().encode('{'));
    expect(pathsOf(await checkArtifact(files))).toEqual(['ZD0740 mcp-provider.json']);
  });

  it('compares the provider version with a valid descriptor for equality only', async () => {
    const descriptor = await readJson<Record<string, unknown>>('mcp-provider.json');
    const catalog = await readJson<CatalogManifest>('catalog.json');
    catalog.provider.version = '1'.repeat(300);
    const findings = checkCatalog(catalog, descriptor);
    expect(findings.map((item) => `${item.code} ${item.message}`)).toEqual([
      'ZD0741 provider/version: provider version differs from the descriptor version',
    ]);
    // Without a descriptor the length rule still applies.
    expect(checkCatalog(catalog).map((item) => `${item.code} ${item.message}`)).toEqual([
      'ZD0741 provider/version: provider version is too long',
    ]);
  });
});
