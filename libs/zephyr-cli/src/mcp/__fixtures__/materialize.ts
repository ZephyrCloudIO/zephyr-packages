import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Canonical contract fixtures copied byte for byte from the M1 contract. */
export const contractFixtures = path.join(import.meta.dirname, 'contract');

/** Suffix of a fixture file stored as base64 because its bytes are not UTF-8. */
export const BASE64_FIXTURE_SUFFIX = '.base64';

/**
 * Copy a fixture tree into a fresh temp directory named `name`, materialize every
 * `SKILL.fixture.md` as `SKILL.md` with identical bytes (contract section 9), and decode
 * every `<name>.base64` into `<name>` (contract amendment 13.5: binary fixtures are not
 * stored in the repository).
 */
export async function materializeFixture(
  fixturePath: string,
  name: string,
  temporaryDirectories: string[]
): Promise<string> {
  const root = await fs.promises.mkdtemp(path.join(tmpdir(), 'zephyr-cli-mcp-'));
  temporaryDirectories.push(root);
  const target = path.join(root, name);
  await fs.promises.cp(path.join(contractFixtures, fixturePath), target, {
    recursive: true,
  });
  await materializeFixtureFiles(target);
  return target;
}

export async function makeTemporaryDirectory(
  name: string,
  temporaryDirectories: string[]
): Promise<string> {
  const root = await fs.promises.mkdtemp(path.join(tmpdir(), 'zephyr-cli-mcp-'));
  temporaryDirectories.push(root);
  const target = path.join(root, name);
  await fs.promises.mkdir(target);
  return target;
}

export async function removeTemporaryDirectories(directories: string[]): Promise<void> {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))
  );
}

export async function writeFile(
  root: string,
  relativePath: string,
  content: string | Uint8Array
): Promise<void> {
  const absolutePath = path.join(root, ...relativePath.split('/'));
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.promises.writeFile(absolutePath, content);
}

export function readContractJson<T>(relativePath: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(contractFixtures, ...relativePath.split('/')), 'utf8')
  ) as T;
}

/** Sha256 of every file, keyed by `/` path, to prove a scan wrote nothing. */
export async function captureTree(root: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else {
        snapshot[path.relative(root, absolutePath).split(path.sep).join('/')] =
          createHash('sha256')
            .update(await fs.promises.readFile(absolutePath))
            .digest('hex');
      }
    }
  };
  await visit(root);
  return snapshot;
}

/** Decode a `.base64` fixture: base64 of the exact bytes, one line plus a newline. */
export function decodeBase64Fixture(text: string): Buffer {
  return Buffer.from(text.trim(), 'base64');
}

async function materializeFixtureFiles(directory: string): Promise<void> {
  for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await materializeFixtureFiles(absolutePath);
    } else if (entry.name === 'SKILL.fixture.md') {
      await fs.promises.rename(absolutePath, path.join(directory, 'SKILL.md'));
    } else if (entry.name.endsWith(BASE64_FIXTURE_SUFFIX)) {
      const bytes = decodeBase64Fixture(await fs.promises.readFile(absolutePath, 'utf8'));
      await fs.promises.writeFile(
        absolutePath.slice(0, -BASE64_FIXTURE_SUFFIX.length),
        bytes
      );
      await fs.promises.rm(absolutePath);
    }
  }
}
