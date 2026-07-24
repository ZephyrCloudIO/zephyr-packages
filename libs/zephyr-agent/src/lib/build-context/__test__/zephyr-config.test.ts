import { afterEach, describe, expect, it } from '@rstest/core';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ZeErrors, ZephyrError } from '../../errors';
import { defineConfig, getZephyrConfig, mergeRemoteDependencies } from '../zephyr-config';

describe('zephyr config', () => {
  const roots: string[] = [];
  const configEnvKeys = [
    'ZEPHYR_ORG',
    'ZEPHYR_PROJECT',
    'ZEPHYR_APP_NAME',
    'ZEPHYR_REMOTE_DEPENDENCIES',
    'ZEPHYR_ENV_VARS',
    'ZEPHYR_CONFIG_TEST_SECRET',
  ] as const;
  const originalConfigEnv = Object.fromEntries(
    configEnvKeys.map((key) => [key, process.env[key]])
  );

  function createRoot(name = 'case'): string {
    const root = mkdtempSync(join(tmpdir(), `zephyr-config-${name}-`));
    roots.push(root);
    return root;
  }

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
    for (const key of configEnvKeys) {
      const value = originalConfigEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    Reflect.deleteProperty(globalThis, '__ZEPHYR_CONFIG_LOAD_COUNT__');
  });

  it('loads a strict config from a parent of a nested build context', () => {
    const root = createRoot();
    const context = join(root, 'apps', 'web');
    mkdirSync(context, { recursive: true });
    writeFileSync(
      join(root, 'zephyr.config.ts'),
      `export default {
        org: ' configured-org ',
        project: 'configured-project',
        appName: 'configured-app',
        remoteDependencies: {
          remote: ' zephyr:remote.remote-project.remote-org@latest ',
        },
        dependencyUrlMode: 'version',
      } satisfies Record<string, unknown>;`
    );

    const config = getZephyrConfig(context);

    expect(config).toEqual({
      org: 'configured-org',
      project: 'configured-project',
      appName: 'configured-app',
      remoteDependencies: {
        remote: 'zephyr:remote.remote-project.remote-org@latest',
      },
      dependencyUrlMode: 'version',
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.remoteDependencies)).toBe(true);
  });

  it('supports TypeScript and JavaScript ESM and CommonJS extensions', () => {
    const cases = [
      ['zephyr.config.ts', "export default { appName: 'ts-app' }", 'ts-app'],
      ['zephyr.config.mts', "export default { appName: 'mts-app' }", 'mts-app'],
      ['zephyr.config.cts', "export default { appName: 'cts-app' }", 'cts-app'],
      ['zephyr.config.js', "module.exports = { appName: 'js-app' }", 'js-app'],
      ['zephyr.config.mjs', "export default { appName: 'mjs-app' }", 'mjs-app'],
      ['zephyr.config.cjs', "module.exports = { appName: 'cjs-app' }", 'cjs-app'],
    ] as const;

    for (const [fileName, source, appName] of cases) {
      const root = createRoot(fileName.replaceAll('.', '-'));
      writeFileSync(join(root, fileName), source);
      expect(getZephyrConfig(root).appName).toBe(appName);
    }
  });

  it('returns an immutable empty config when no file is present', () => {
    const config = getZephyrConfig(createRoot());
    expect(config).toEqual({});
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('executes one cached module per fingerprint and reloads after a file change', () => {
    const root = createRoot();
    const configPath = join(root, 'zephyr.config.cjs');
    const source = `
      globalThis.__ZEPHYR_CONFIG_LOAD_COUNT__ =
        (globalThis.__ZEPHYR_CONFIG_LOAD_COUNT__ || 0) + 1;
      module.exports = {
        appName: 'run-' + globalThis.__ZEPHYR_CONFIG_LOAD_COUNT__,
      };
    `;
    writeFileSync(configPath, source);

    const first = getZephyrConfig(root);
    const cached = getZephyrConfig(root);
    expect(first).toBe(cached);
    expect(first.appName).toBe('run-1');

    writeFileSync(configPath, `${source}\n// fingerprint changed`);
    const reloaded = getZephyrConfig(root);
    expect(reloaded).not.toBe(first);
    expect(reloaded.appName).toBe('run-2');
  });

  it('does not read identity or dependency environment overrides', () => {
    const root = createRoot();
    writeFileSync(
      join(root, 'zephyr.config.ts'),
      "export default { org: 'file-org', project: 'file-project' }"
    );
    process.env['ZEPHYR_ORG'] = 'env-org';
    process.env['ZEPHYR_PROJECT'] = 'env-project';
    process.env['ZEPHYR_APP_NAME'] = 'env-app';
    process.env['ZEPHYR_REMOTE_DEPENDENCIES'] = '{"remote":"latest"}';
    delete process.env['ZEPHYR_CONFIG_TEST_SECRET'];
    process.env['ZEPHYR_ENV_VARS'] = '{"ZEPHYR_CONFIG_TEST_SECRET":"value"}';

    expect(getZephyrConfig(root)).toEqual({
      org: 'file-org',
      project: 'file-project',
    });
    expect(process.env['ZEPHYR_CONFIG_TEST_SECRET']).toBeUndefined();
  });

  it('rejects unknown fields, invalid values, and blank values', () => {
    const cases = [
      ["export default { app: 'alias' }", /unknown field: app/],
      ['export default []', /default export must be an object/],
      ['export default { org: 42 }', /org must be a string/],
      ["export default { project: '   ' }", /project must not be empty/],
      [
        'export default { remoteDependencies: { remote: 42 } }',
        /remoteDependencies\.remote must be a string/,
      ],
      [
        "export default { remoteDependencies: { remote: '   ' } }",
        /remoteDependencies\.remote must not be empty/,
      ],
      [
        "export default { dependencyUrlMode: 'tag' }",
        /dependencyUrlMode must be either "selector" or "version"/,
      ],
    ] as const;

    for (const [source, expected] of cases) {
      const root = createRoot();
      writeFileSync(join(root, 'zephyr.config.ts'), source);
      expect(() => getZephyrConfig(root)).toThrow(expected);
    }
  });

  it('rejects ambiguous config files in the same directory', () => {
    const root = createRoot();
    writeFileSync(join(root, 'zephyr.config.ts'), 'export default {}');
    writeFileSync(join(root, 'zephyr.config.mjs'), 'export default {}');

    expect(() => getZephyrConfig(root)).toThrow(/multiple config files found/);
  });

  it('wraps config failures with a bounded, redacted message', () => {
    const root = createRoot();
    const secret = 'do-not-leak-this-token';
    writeFileSync(
      join(root, 'zephyr.config.ts'),
      `throw new Error(${JSON.stringify(`config exploded ${'x'.repeat(5_000)} token=${secret}`)})`
    );

    try {
      getZephyrConfig(root);
      throw new Error('expected config loading to fail');
    } catch (error: unknown) {
      expect(ZephyrError.is(error, ZeErrors.ERR_ZEPHYR_CONFIG_NOT_VALID)).toBe(true);
      expect((error as Error).message).toContain('config exploded');
      expect((error as Error).message).toContain('[truncated]');
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message.length).toBeLessThan(1_300);
    }
  });

  it('merges config remotes over package remotes without mutation', () => {
    const packageDependencies = { shared: '1.0.0', packageOnly: '2.0.0' };
    const config = Object.freeze({
      remoteDependencies: Object.freeze({ shared: 'latest', configOnly: 'next' }),
    });

    expect(mergeRemoteDependencies(packageDependencies, config)).toEqual({
      shared: 'latest',
      packageOnly: '2.0.0',
      configOnly: 'next',
    });
    expect(packageDependencies).toEqual({ shared: '1.0.0', packageOnly: '2.0.0' });
  });

  it('defineConfig preserves the user object for contextual typing', () => {
    const config = { org: 'org', project: 'project' };
    expect(defineConfig(config)).toBe(config);
  });
});
