import { describe, expect, test } from '@rstest/core';
import vm from 'node:vm';

import { rewriteEnvReadsToNativeLookup } from './native-env-rewrite';

const UID = 'host.project.org';

interface RunOptions {
  runtimeEnv?: Record<string, Record<string, string>>;
  processEnv?: Record<string, string>;
  buildEnv?: Record<string, string>;
}

function compile(source: string, buildEnv: Record<string, string> = {}): string {
  const result = rewriteEnvReadsToNativeLookup(source, {
    filename: 'src/App.js',
    applicationUid: UID,
    buildEnv,
  });
  if (!result) throw new Error('expected a rewrite');
  return result.code;
}

function run(source: string, options: RunOptions = {}): unknown {
  const sandbox = {
    module: { exports: undefined as unknown },
    process: { env: { ...options.processEnv } },
    __ZEPHYR__: options.runtimeEnv
      ? { version: 1, runtime: { env: options.runtimeEnv } }
      : undefined,
  };
  vm.runInNewContext(compile(source, options.buildEnv), sandbox);
  return sandbox.module.exports;
}

describe('rewriteEnvReadsToNativeLookup', () => {
  test('falls back to the build value, or undefined for unknown keys', () => {
    const source = `module.exports = [process.env.ZE_PUBLIC_A, import.meta.env['ZE_PUBLIC_B'], process.env[\`ZE_PUBLIC_C\`]];`;
    expect(
      run(source, { buildEnv: { ZE_PUBLIC_A: 'build-a', ZE_PUBLIC_B: 'build-b' } })
    ).toEqual(['build-a', 'build-b', undefined]);
  });

  test('runtime values for the own UID win, including empty strings', () => {
    const source = `module.exports = [process.env.ZE_PUBLIC_A, process.env.ZE_PUBLIC_B];`;
    expect(
      run(source, {
        buildEnv: { ZE_PUBLIC_A: 'build-a', ZE_PUBLIC_B: 'build-b' },
        runtimeEnv: {
          [UID]: { ZE_PUBLIC_A: '' },
          'other.project.org': { ZE_PUBLIC_B: 'other-b' },
        },
      })
    ).toEqual(['', 'build-b']);
  });

  test('keeps operator precedence around the lookup', () => {
    const source = `module.exports = process.env.ZE_PUBLIC_A || 'x';`;
    expect(run(source)).toBe('x');
    expect(run(source, { runtimeEnv: { [UID]: { ZE_PUBLIC_A: 'runtime' } } })).toBe(
      'runtime'
    );
  });

  test('destructuring keeps alias, default, rest and non-public keys', () => {
    const source = [
      `const { ZE_PUBLIC_A: alias, ZE_PUBLIC_B = 'default-b', NODE_ENV, ...rest } = process.env;`,
      `module.exports = { alias, b: ZE_PUBLIC_B, NODE_ENV, restA: rest.ZE_PUBLIC_A };`,
    ].join('\n');
    expect(
      run(source, {
        buildEnv: { ZE_PUBLIC_A: 'build-a' },
        processEnv: { NODE_ENV: 'production' },
        runtimeEnv: { [UID]: { ZE_PUBLIC_A: 'runtime-a' } },
      })
    ).toEqual({
      alias: 'runtime-a',
      b: 'default-b',
      NODE_ENV: 'production',
      restA: undefined,
    });
  });

  test('destructuring import.meta.env yields script-safe code for rewritten keys', () => {
    const source = [
      `const { ZE_PUBLIC_A } = import.meta.env;`,
      `let uid;`,
      `({ ZE_PUBLIC_B: uid } = import.meta.env);`,
      `module.exports = [ZE_PUBLIC_A, uid];`,
    ].join('\n');
    expect(compile(source)).not.toContain('import.meta');
    expect(
      run(source, { buildEnv: { ZE_PUBLIC_A: 'build-a', ZE_PUBLIC_B: 'build-b' } })
    ).toEqual(['build-a', 'build-b']);
  });

  test('leaves writes, strings and comments untouched', () => {
    const source = [
      `process.env.ZE_PUBLIC_A = 'w';`,
      `process.env.ZE_PUBLIC_B++;`,
      `delete process.env.ZE_PUBLIC_C;`,
      `({ x: process.env.ZE_PUBLIC_D } = { x: 1 });`,
      `const s = 'process.env.ZE_PUBLIC_A'; // process.env.ZE_PUBLIC_A`,
    ].join('\n');
    expect(
      rewriteEnvReadsToNativeLookup(source, {
        filename: 'src/a.js',
        applicationUid: UID,
        buildEnv: {},
      })
    ).toBeNull();
  });

  test('parses TSX and Flow sources', () => {
    const tsx = `const App = (): JSX.Element => <Text>{process.env.ZE_PUBLIC_A as string}</Text>;`;
    const flow = `// @flow\nfunction f(x: ?string): string { return x ?? process.env.ZE_PUBLIC_A; }`;
    for (const [filename, source] of [
      ['src/App.tsx', tsx],
      ['src/f.js', flow],
    ]) {
      const result = rewriteEnvReadsToNativeLookup(source, {
        filename,
        applicationUid: UID,
        buildEnv: {},
      });
      expect(result?.code).toContain(`globalThis.__ZEPHYR__?.runtime?.env?.["${UID}"]`);
      expect(result?.code).not.toContain('process.env.ZE_PUBLIC_A');
    }
  });

  test('parses Flow component and hook declarations', () => {
    const source = [
      `// @flow`,
      `component App() { return <Text>{process.env.ZE_PUBLIC_A}</Text>; }`,
      `hook useEndpoint(): string { return process.env.ZE_PUBLIC_A; }`,
    ].join('\n');
    const code = compile(source);
    expect(code).toContain(`component App() { return <Text>{(globalThis.__ZEPHYR__`);
    expect(code).toContain(`hook useEndpoint(): string { return (globalThis.__ZEPHYR__`);
    expect(code).not.toContain('process.env.ZE_PUBLIC_A');
  });

  test('preserves the line count', () => {
    const source = [
      `const { ZE_PUBLIC_A } = process.env;`,
      `const b = process.env.ZE_PUBLIC_B;`,
      `module.exports = [ZE_PUBLIC_A, b];`,
    ].join('\n');
    const code = compile(source, { ZE_PUBLIC_A: 'line\nbreak\u2028sep' });
    expect(code.split(/\r\n|\r|\n|\u2028|\u2029/).length).toBe(3);
  });

  test('keeps line breaks inside multiline reads', () => {
    const source = [
      `const a = process.env\r\n  .ZE_PUBLIC_A;`,
      `const b = process.env[`,
      `  'ZE_PUBLIC_B'];`,
      `module.exports = [a, b];`,
    ].join('\n');
    const lines = (code: string) => code.split(/\r\n|\r|\n|\u2028|\u2029/);
    const code = compile(source, { ZE_PUBLIC_A: 'build-a', ZE_PUBLIC_B: 'build-b' });
    expect(lines(code).length).toBe(lines(source).length);
    expect(lines(code).at(-1)).toBe('module.exports = [a, b];');
    expect(code).toContain('\r\n');
    expect(
      run(source, { buildEnv: { ZE_PUBLIC_A: 'build-a', ZE_PUBLIC_B: 'build-b' } })
    ).toEqual(['build-a', 'build-b']);
  });

  test('throws with the filename on invalid syntax', () => {
    expect(() =>
      rewriteEnvReadsToNativeLookup(`const = process.env.ZE_PUBLIC_A;`, {
        filename: 'src/broken.js',
        applicationUid: UID,
        buildEnv: {},
      })
    ).toThrow(/src\/broken\.js/);
  });
});
