// BDD description (unit tests are generated from this description):
//
// Feature: upload guards
//
//   Scenario: compiled output passes
//     Given compiled JS, CSS, HTML and TypeScript declaration files (.d.ts, .d.mts, .d.cts)
//     When assertCompiledOutput runs
//     Then it does not throw
//
//   Scenario: TypeScript source is refused
//     Given a selected .ts, .tsx, .mts or .cts file
//     Then it throws, naming up to 10 paths and "and N more" for the rest
//
//   Scenario: an MPEG-TS segment named .ts is video, not source
//     Given a .ts file whose byte 0 is 0x47 (and byte 188 too when it is longer)
//     Then it passes
//     But a .ts file that starts with "G" and has no sync byte at 188 is refused
//
//   Scenario: a project root is refused
//     Given a selected package.json together with src/ files, a tsconfig.json or a root
//       lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lockb, bun.lock)
//     Then it throws
//     And package.json alone, a lockfile alone, or src/ without package.json, passes
//
//   Scenario: tap-app and empty input
//     Given target tap-app, or an empty list
//     Then nothing throws
//
//   Scenario: a Wrangler config without a zephyr.config.json is refused
//     Given wrangler.toml, wrangler.json or wrangler.jsonc (any case, any folder)
//       and no zephyr.config.json in effect (flags do not count as a config)
//     Then assertNoUnconfiguredWorkerConfig throws naming the file and asking for a
//       zephyr.config.json with explicit include and exclude
//     And with a config, or without a Wrangler file, it passes
import { describe, expect, it } from '@rstest/core';
import { assertCompiledOutput, assertNoUnconfiguredWorkerConfig } from './upload-guards';

function files(paths: readonly string[]): { path: string; content: string }[] {
  return paths.map((path) => ({ path, content: 'x' }));
}

function mpegTs(length: number): Buffer {
  const bytes = Buffer.alloc(length);
  for (let offset = 0; offset < length; offset += 188) bytes[offset] = 0x47;
  return bytes;
}

describe('assertCompiledOutput', () => {
  it('accepts compiled output and declaration files', () => {
    expect(() =>
      assertCompiledOutput(
        files([
          'index.js',
          'a.css',
          'index.html',
          'types.d.ts',
          'x.d.mts',
          'y.d.cts',
          'package.json',
        ]),
        'web'
      )
    ).not.toThrow();
  });

  it.each(['a.ts', 'src/b.tsx', 'c.mts', 'd.cts', 'E.TS'])('refuses %s', (path) => {
    expect(() => assertCompiledOutput(files(['index.js', path]), 'worker')).toThrow(
      /TypeScript source files/
    );
  });

  it('lists at most 10 paths and counts the rest', () => {
    const paths = Array.from({ length: 13 }, (_, i) => `f${i}.ts`);
    expect(() => assertCompiledOutput(files(paths), undefined)).toThrow(/and 3 more/);
    expect(() => assertCompiledOutput(files(paths.slice(0, 10)), undefined)).not.toThrow(
      /more/
    );
  });

  it('refuses a project root', () => {
    expect(() =>
      assertCompiledOutput(files(['package.json', 'src/main.js']), 'web')
    ).toThrow(/project root/);
    expect(() =>
      assertCompiledOutput(files(['package.json', 'tsconfig.json']), 'web')
    ).toThrow(/project root/);
  });

  it('refuses a root lockfile next to package.json', () => {
    for (const lockfile of [
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'bun.lockb',
      'bun.lock',
    ]) {
      expect(() =>
        assertCompiledOutput(files(['package.json', lockfile]), 'web')
      ).toThrow(/project root/);
      expect(() => assertCompiledOutput(files([lockfile]), 'web')).not.toThrow();
    }
    expect(() =>
      assertCompiledOutput(files(['package.json', 'sub/yarn.lock']), 'web')
    ).not.toThrow();
  });

  it('lets an MPEG-TS segment named .ts pass', () => {
    expect(() =>
      assertCompiledOutput(
        [{ path: 'seg0.ts', content: Buffer.from([0x47, 0x40]) }],
        'web'
      )
    ).not.toThrow();
    expect(() =>
      assertCompiledOutput([{ path: 'hls/seg1.ts', content: mpegTs(188 * 3) }], 'web')
    ).not.toThrow();
  });

  it('refuses TypeScript that merely starts with the sync character', () => {
    const source = Buffer.from(`G${'a'.repeat(300)}`);
    expect(() =>
      assertCompiledOutput([{ path: 'g.ts', content: source }], 'web')
    ).toThrow(/TypeScript source/);
    const brokenSegment = mpegTs(188 * 2);
    brokenSegment[188] = 0x00;
    expect(() =>
      assertCompiledOutput([{ path: 'x.ts', content: brokenSegment }], 'web')
    ).toThrow(/TypeScript source/);
    expect(() => assertCompiledOutput([{ path: 'e.ts', content: '' }], 'web')).toThrow(
      /TypeScript source/
    );
  });

  it('accepts package.json alone and src/ without package.json', () => {
    expect(() =>
      assertCompiledOutput(files(['package.json', 'index.js']), 'web')
    ).not.toThrow();
    expect(() => assertCompiledOutput(files(['src/main.js']), 'web')).not.toThrow();
  });

  it('lets tap-app and an empty list pass', () => {
    expect(() =>
      assertCompiledOutput(files(['a.ts', 'package.json', 'src/x']), 'tap-app')
    ).not.toThrow();
    expect(() => assertCompiledOutput(files([]), 'web')).not.toThrow();
  });
});

describe('assertNoUnconfiguredWorkerConfig', () => {
  it.each(['wrangler.toml', 'wrangler.json', 'wrangler.jsonc', 'sub/Wrangler.TOML'])(
    'refuses %s without a config',
    (path) => {
      expect(() => assertNoUnconfiguredWorkerConfig(['index.js', path], false)).toThrow(
        new RegExp(`${path.replace('.', '\\.')}.*zephyr\\.config\\.json`, 's')
      );
    }
  );

  it('says that flags do not count as a config', () => {
    expect(() => assertNoUnconfiguredWorkerConfig(['wrangler.toml'], false)).toThrow(
      /--include and --exclude flags do not count/
    );
  });

  it('passes with a config, without a Wrangler file, or for an empty list', () => {
    expect(() => assertNoUnconfiguredWorkerConfig(['wrangler.toml'], true)).not.toThrow();
    expect(() =>
      assertNoUnconfiguredWorkerConfig(['index.js', 'wrangler.txt'], false)
    ).not.toThrow();
    expect(() => assertNoUnconfiguredWorkerConfig([], false)).not.toThrow();
  });
});
