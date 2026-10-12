import { cp, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Where the fixture trees live in the repo. */
export const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

const BASE64_SUFFIX = '.base64';
// Stored under other names so the workspace sees neither a package nor an
// Agent Skill; materialized under their real names.
const FIXTURE_NAMES: Readonly<Record<string, string>> = {
  'package.fixture.json': 'package.json',
  'SKILL.fixture.md': 'SKILL.md',
};

/**
 * Replaces every `<name>.base64` under `dir` with `<name>`, holding the decoded bytes.
 * Binary fixtures are stored as base64 text so the repo has no blobs (contract 13.5);
 * tests see the original file with identical bytes. Also restores `package.json` and
 * `SKILL.md` from their stored names: a real `package.json` would join the pnpm
 * workspace, and Intent would treat every `SKILL.md` as a skill of this package.
 */
export const decodeBase64Files = async (dir: string): Promise<void> => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await decodeBase64Files(file);
    else if (entry.isFile() && entry.name.endsWith(BASE64_SUFFIX)) {
      const text = await readFile(file, 'utf8');
      await writeFile(
        file.slice(0, -BASE64_SUFFIX.length),
        Buffer.from(text.trim(), 'base64')
      );
      await rm(file);
    } else if (entry.isFile() && Object.hasOwn(FIXTURE_NAMES, entry.name)) {
      await rename(file, path.join(dir, FIXTURE_NAMES[entry.name] ?? entry.name));
    }
  }
};

export interface MaterializedFixture {
  /** Absolute path of the copy, with binary files decoded. */
  root: string;
  /** Removes the copy. */
  cleanup: () => Promise<void>;
}

/**
 * Copies `fixtures/<name>` to a fresh directory and decodes its base64 fixtures there, so
 * tests read real files without the repo holding any.
 *
 * `parent` defaults to the system temp directory. Pass `fixturesDir` for a tree whose
 * sources import the package by a relative path or resolve the workspace's packages: the
 * copy then sits at the same depth as the original.
 */
export const materializeFixture = async (
  name: string,
  parent: string = os.tmpdir()
): Promise<MaterializedFixture> => {
  const scratch = await mkdtemp(
    path.join(parent, `.fixture-${name.replace(/\W+/g, '-')}-`)
  );
  const source = path.join(fixturesDir, name);
  // Build output and installed packages are never fixtures.
  await cp(source, scratch, {
    recursive: true,
    filter: (file) => {
      const parts = path.relative(source, file).split(path.sep);
      return parts[0] !== 'dist' && !parts.includes('node_modules');
    },
  });
  await decodeBase64Files(scratch);
  return {
    root: scratch,
    cleanup: () => rm(scratch, { recursive: true, force: true }),
  };
};
