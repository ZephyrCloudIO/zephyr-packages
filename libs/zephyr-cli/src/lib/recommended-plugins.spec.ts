import { describe, expect, it } from '@rstest/core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const librariesRoot = join(__dirname, '../../..');
const workspacePackages = new Set(
  readdirSync(librariesRoot)
    .map((directory) => join(librariesRoot, directory, 'package.json'))
    .filter((manifest) => existsSync(manifest))
    .map((manifest) => JSON.parse(readFileSync(manifest, 'utf8')).name as string)
);

describe('recommended Zephyr plugins', () => {
  it('names only packages published from this workspace', () => {
    const recommended = ['commands/run.ts', 'lib/command-detector.ts'].flatMap((file) =>
      [
        ...readFileSync(join(__dirname, '..', file), 'utf8').matchAll(
          /(?:@zephyrcloud\/[\w-]+|[\w-]*zephyr[\w-]*-plugin|[\w-]+-plugin-zephyr)/gu
        ),
      ].map((match) => match[0])
    );

    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended.filter((name) => !workspacePackages.has(name))).toEqual([]);
  });
});
