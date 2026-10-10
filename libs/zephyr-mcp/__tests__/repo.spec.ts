import { createHash } from 'node:crypto';
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

describe('loadRepo', () => {
  let scratch = '';
  afterAll(async () => {
    if (scratch) await rm(scratch, { recursive: true, force: true });
  });

  it('serves exactly the contract file set of repos/skills-basic, as raw bytes', async () => {
    const root = path.join(contract, 'repos/skills-basic');
    const repo = await loadRepo(root);
    expect(repo.tools).toEqual([]);
    expect(repo.skills.map((skill) => [skill.name, skill.path])).toEqual([
      ['quote-a-deal', 'skills/quote-a-deal'],
      ['release-a-frontend', 'skills/release-a-frontend'],
    ]);
    const [quote] = repo.skills;
    // No dotfile, no evals/, no *.map; the TypeScript script and binary are served.
    expect(quote?.files.map((file) => file.path)).toEqual([
      'SKILL.md',
      'assets/logo.bin',
      'references/Zebra.md',
      'references/apple.md',
      'references/price-book.md',
      'scripts/check.ts',
    ]);
    for (const file of quote?.files ?? []) {
      expect(Buffer.from(file.bytes)).toEqual(
        await readFile(path.join(root, 'skills/quote-a-deal', file.path))
      );
    }
  });

  it('globs tool files by the contract and skips symlinks', async () => {
    scratch = await mkdtemp(path.join(os.tmpdir(), 'mcp-repo-'));
    const files = [
      'tools/quote_price.ts',
      'tools/Look-Up.ts',
      'tools/.hidden.ts',
      'tools/_shared.ts',
      'tools/types.d.ts',
      'tools/quote_price.test.ts',
      'tools/quote_price.spec.ts',
      'tools/readme.md',
      'tools/nested/inner.ts',
      'skills/no-skill/references/x.md',
      'skills/.hidden/SKILL.md',
      'skills/node_modules/SKILL.md',
    ];
    for (const file of files) {
      await mkdir(path.dirname(path.join(scratch, file)), { recursive: true });
      await writeFile(path.join(scratch, file), 'export {};');
    }
    await symlink(
      path.join(scratch, 'tools/quote_price.ts'),
      path.join(scratch, 'tools/linked.ts')
    );
    const repo = await loadRepo(scratch);
    // Glob semantics: `tools/*.ts` never matches a dotfile.
    expect(repo.tools).toEqual(['tools/Look-Up.ts', 'tools/quote_price.ts']);
    expect(repo.skills).toEqual([]);
  });

  it('never serves a skill folder named evals, in any case', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mcp-repo-evals-'));
    try {
      // One mixed-case folder: case-insensitive filesystems fold evals/EVALS.
      for (const folder of ['Evals', 'kept']) {
        const file = path.join(root, 'skills', folder, 'SKILL.md');
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, `---\nname: ${folder}\ndescription: x\n---\n`);
      }
      const repo = await loadRepo(root);
      expect(repo.skills.map((skill) => skill.name)).toEqual(['kept']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  // zephyr-agent, ze-cli, the edge and the Zephyr MCP deny *.map in any
  // case; serving notes.MAP would build an artifact the deploy refuses.
  it('drops *.map in any case', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mcp-repo-map-'));
    try {
      const skill = path.join(root, 'skills', 'maps');
      await mkdir(path.join(skill, 'references'), { recursive: true });
      await writeFile(path.join(skill, 'SKILL.md'), '---\nname: maps\n---\n');
      await writeFile(path.join(skill, 'references', 'a.map'), '{}');
      await writeFile(path.join(skill, 'references', 'b.MAP'), '{}');
      await writeFile(path.join(skill, 'references', 'c.Map'), '{}');
      await writeFile(path.join(skill, 'references', 'mapping.md'), '# m');
      const repo = await loadRepo(root);
      expect(repo.skills[0]?.files.map((file) => file.path)).toEqual([
        'SKILL.md',
        'references/mapping.md',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  // 13.5: the base64 fixture comes back as the original file, same bytes.
  it('materializes binary fixtures with identical bytes', async () => {
    const expected = JSON.parse(
      await readFile(
        path.join(contract, 'repos/skills-basic.expected-catalog.json'),
        'utf8'
      )
    ) as {
      skills: Array<{ files: Array<{ path: string; sha256: string }> }>;
    };
    const listed = expected.skills[0]?.files.find(
      (file) => file.path === 'assets/logo.bin'
    );
    for (const root of ['repos/skills-basic', 'artifacts/tools-basic']) {
      const asset = path.join(contract, root, 'skills/quote-a-deal/assets');
      const names = await readdir(asset);
      expect(names).toContain('logo.bin');
      expect(names.filter((name) => name.endsWith('.base64'))).toEqual([]);
      const bytes = await readFile(path.join(asset, 'logo.bin'));
      expect(bytes.includes(0)).toBe(true);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(listed?.sha256);
    }
  });

  it('allows a repo without skills/ or tools/', async () => {
    expect(await loadRepo(path.join(contract, 'artifacts'))).toMatchObject({
      skills: [],
      tools: [],
    });
  });
});
