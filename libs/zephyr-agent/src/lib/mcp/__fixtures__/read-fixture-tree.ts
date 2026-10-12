import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Canonical contract fixtures copied byte for byte from the M1 contract. */
export const contractFixtures = join(import.meta.dirname, 'contract');

/** Suffix of a fixture file stored as base64 because its bytes are not UTF-8. */
export const BASE64_FIXTURE_SUFFIX = '.base64';

/** Decode a `.base64` fixture: base64 of the exact bytes, one line plus a newline. */
export function decodeBase64Fixture(text: string): Buffer {
  return Buffer.from(text.trim(), 'base64');
}

/**
 * Read a fixture tree into memory keyed by `/` path, materializing every
 * `SKILL.fixture.md` as `SKILL.md` (contract section 9) and every `<name>.base64` as
 * `<name>` with the decoded bytes (amendment 13.5: no binary blobs in the repository).
 */
export function readFixtureTree(root: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const absolute = join(directory, entry);
      if (statSync(absolute).isDirectory()) {
        visit(absolute);
        continue;
      }
      const path = relative(root, absolute)
        .split(sep)
        .join('/')
        .replace(/SKILL\.fixture\.md$/, 'SKILL.md');
      if (path.endsWith(BASE64_FIXTURE_SUFFIX)) {
        files.set(
          path.slice(0, -BASE64_FIXTURE_SUFFIX.length),
          decodeBase64Fixture(readFileSync(absolute, 'utf8'))
        );
      } else {
        files.set(path, readFileSync(absolute));
      }
    }
  };
  visit(root);
  return files;
}
