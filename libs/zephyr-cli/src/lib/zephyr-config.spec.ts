// BDD description (unit tests are generated from this description):
//
// Feature: zephyr.config.json loading and validation
//
//   Scenario: valid configs
//     Given a minimal config (version, output, include) or a full config
//     Then loadZephyrConfig returns it, and JSONC comments are accepted
//
//   Scenario: invalid configs
//     Given a missing or unsupported version, an extra property, an absolute or ".."
//       pattern, an empty include, a missing output or a bad target
//     Then it throws an error that names the file and lists the problems
//     And a file that is not JSON is reported as such
//
//   Scenario: path errors read as plain advice
//     Given a backslash, absolute, drive-letter or ".." value in output, include or exclude
//     Then the error says the value "must be a relative path using '/', without '..' or a
//       drive letter" instead of a regular expression
//
//   Scenario: missing and unreadable files
//     Given no file at the default location
//     Then it returns undefined
//     And an explicit --config path that does not exist throws
//     And a path that cannot be read as a file (a directory) throws
//
//   Scenario: schema contract
//     Given the published schema
//     Then its target enum equals ZEPHYR_BUILD_TARGETS, its version enum equals the
//       supported versions, it has additionalProperties false and no default keyword
import { afterAll, beforeAll, describe, expect, it, rs } from '@rstest/core';
// jsonc-parser's UMD build does not bundle under rstest; its ESM build is the same parser.
import * as jsoncEsm from 'jsonc-parser/lib/esm/main.js';

rs.mock('jsonc-parser', () => ({
  parse: jsoncEsm.parse,
  printParseErrorCode: jsoncEsm.printParseErrorCode,
}));

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ZEPHYR_BUILD_TARGETS } from 'zephyr-edge-contract';
import {
  SUPPORTED_CONFIG_VERSIONS,
  loadZephyrConfig,
  resolveConfigPath,
} from './zephyr-config';

describe('zephyr.config.json', () => {
  let directory: string;
  let counter = 0;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'zephyr-config-'));
  });
  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  async function load(text: string): Promise<ReturnType<typeof loadZephyrConfig>> {
    const path = join(directory, `config-${counter++}.json`);
    await writeFile(path, text);
    return loadZephyrConfig({ path, explicit: true });
  }

  const minimal = { version: '1.0.0', output: 'dist', include: ['**/*'] };

  it('accepts a minimal and a full config', async () => {
    await expect(load(JSON.stringify(minimal))).resolves.toEqual(minimal);
    const full = {
      $schema: './schema.json',
      ...minimal,
      exclude: ['**/*.css'],
      target: 'worker',
      metadata: 'meta.json',
    };
    await expect(load(JSON.stringify(full))).resolves.toEqual(full);
  });

  it('accepts JSONC comments and trailing commas', async () => {
    const text = `{
      // Example only, not guidance
      "version": "1.0.0", /* block */
      "output": ".",
      "include": ["**/*",],
    }`;
    await expect(load(text)).resolves.toMatchObject({ output: '.' });
  });

  it.each([
    ['missing version', { output: '.', include: ['*'] }, /version/],
    [
      'unsupported version',
      { ...minimal, version: '2.0.0' },
      /supported versions: 1\.0\.0/,
    ],
    ['extra property', { ...minimal, extra: true }, /unknown property "extra"/],
    ['absolute include', { ...minimal, include: ['/etc/passwd'] }, /include\/0/],
    ['windows drive include', { ...minimal, include: ['C:\\x'] }, /include\/0/],
    ['parent segment in include', { ...minimal, include: ['../x/**'] }, /include\/0/],
    ['parent segment in exclude', { ...minimal, exclude: ['a/../b'] }, /exclude\/0/],
    ['parent output', { ...minimal, output: '../out' }, /output/],
    ['absolute output', { ...minimal, output: '/out' }, /output/],
    ['empty include', { ...minimal, include: [] }, /include/],
    ['missing output', { version: '1.0.0', include: ['*'] }, /output/],
    ['unknown target', { ...minimal, target: 'desktop' }, /target/],
  ])('rejects %s', async (_name, config, message) => {
    await expect(load(JSON.stringify(config))).rejects.toThrow(message);
  });

  it.each([
    ['backslash glob', { ...minimal, exclude: ['assets\\**'] }, '/exclude/0'],
    ['backslash output', { ...minimal, output: 'a\\b' }, '/output'],
    ['drive include', { ...minimal, include: ['C:\\x'] }, '/include/0'],
    ['parent include', { ...minimal, include: ['../x'] }, '/include/0'],
  ])('explains the %s in plain words', async (_name, config, location) => {
    await expect(load(JSON.stringify(config))).rejects.toThrow(
      `${location} must be a relative path using '/', without '..' or a drive letter`
    );
  });

  it('accepts a dot output and look-alike names', async () => {
    const config = { version: '1.0.0', output: '.', include: ['..a/**', 'a..b'] };
    await expect(load(JSON.stringify(config))).resolves.toEqual(config);
  });

  it('names the file in the error', async () => {
    await expect(load('{}')).rejects.toThrow(/config-\d+\.json/);
  });

  it('rejects text that is not JSON', async () => {
    await expect(load('{ nope')).rejects.toThrow(/not valid JSON/);
  });

  it('returns undefined when the default file is missing, throws for an explicit one', async () => {
    const path = join(directory, 'absent.json');
    await expect(loadZephyrConfig({ path, explicit: false })).resolves.toBeUndefined();
    await expect(loadZephyrConfig({ path, explicit: true })).rejects.toThrow(
      /does not exist/
    );
  });

  it('throws when the path cannot be read as a file', async () => {
    await expect(loadZephyrConfig({ path: directory, explicit: false })).rejects.toThrow(
      /cannot be read/
    );
  });

  it('resolves the config path', () => {
    expect(resolveConfigPath('/work/out', undefined, '/cwd')).toEqual({
      path: '/work/out/zephyr.config.json',
      explicit: false,
    });
    expect(resolveConfigPath('/work/out', 'c.json', '/cwd')).toEqual({
      path: '/cwd/c.json',
      explicit: true,
    });
    expect(resolveConfigPath('/work/out', '/abs/c.json', '/cwd').path).toBe(
      '/abs/c.json'
    );
  });

  it('keeps the schema in step with the code', async () => {
    const schema = JSON.parse(
      await readFile(
        join(__dirname, '..', '..', 'schema', 'zephyr.config.schema.json'),
        'utf8'
      )
    );
    expect(schema.properties.target.enum).toEqual([...ZEPHYR_BUILD_TARGETS]);
    expect(schema.properties.version.enum).toEqual([...SUPPORTED_CONFIG_VERSIONS]);
    expect(schema.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).not.toContain('"default"');
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });
});
