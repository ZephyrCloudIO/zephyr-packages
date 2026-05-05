import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyZephyrConfigEnv, getZephyrConfig } from '../zephyr-config';

describe('zephyr config', () => {
  const originalEnv = { ...process.env };
  let root: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['ZEPHYR_ORG'];
    delete process.env['ZEPHYR_PARENT_ORG'];
    delete process.env['ZEPHYR_PROJECT'];
    delete process.env['ZEPHYR_APP_NAME'];
    delete process.env['ZEPHYR_ENV_VARS'];
    delete process.env['ZEPHYR_REMOTE_DEPENDENCIES'];
    root = mkdtempSync(join(tmpdir(), 'zephyr-config-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    process.env = { ...originalEnv };
  });

  it('loads app metadata, remote dependencies, and env values from zephyr.config.ts', () => {
    const appDir = join(root, 'apps', 'web');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(root, 'zephyr.config.ts'),
      `export default ${JSON.stringify({
        org: 'configured-org',
        parentOrg: 'configured-parent',
        project: 'configured-project',
        appName: 'configured-app',
        remoteDependencies: {
          'remote-app': 'zephyr:remote-app.remote-project.remote-org@latest',
        },
        env: {
          ZE_PUBLIC_API_URL: 'https://example.com',
        },
      })} satisfies Record<string, unknown>;`
    );

    const config = getZephyrConfig(appDir);

    expect(config).toMatchObject({
      org: 'configured-org',
      parentOrg: 'configured-parent',
      project: 'configured-project',
      app: 'configured-app',
      rawZephyrDependencies: {
        'remote-app': 'zephyr:remote-app.remote-project.remote-org@latest',
      },
      env: {
        ZE_PUBLIC_API_URL: 'https://example.com',
      },
    });
    expect(config.zephyrDependencies?.['remote-app']).toMatchObject({
      app_uid: 'remote-app.remote-project.remote-org',
      version: 'latest',
    });
  });

  it('lets environment variables override zephyr.config.ts values', () => {
    writeFileSync(
      join(root, 'zephyr.config.ts'),
      `export default ${JSON.stringify({
        org: 'file-org',
        project: 'file-project',
        appName: 'file-app',
        env: { ZE_PUBLIC_FROM_FILE: 'file' },
      })};`
    );
    process.env['ZEPHYR_ORG'] = 'env-org';
    process.env['ZEPHYR_PROJECT'] = 'env-project';
    process.env['ZEPHYR_APP_NAME'] = 'env-app';
    process.env['ZEPHYR_ENV_VARS'] = JSON.stringify({ ZE_PUBLIC_FROM_ENV: 'env' });

    expect(getZephyrConfig(root)).toMatchObject({
      org: 'env-org',
      project: 'env-project',
      app: 'env-app',
      env: {
        ZE_PUBLIC_FROM_FILE: 'file',
        ZE_PUBLIC_FROM_ENV: 'env',
      },
    });
  });

  it('loads JavaScript config file formats', () => {
    const cases = [
      ['zephyr.config.js', "module.exports = { appName: 'js-app' };", 'js-app'],
      ['zephyr.config.mjs', "export default { appName: 'mjs-app' };", 'mjs-app'],
      ['zephyr.config.cjs', "module.exports = { appName: 'cjs-app' };", 'cjs-app'],
      ['zephyr.config.mts', "export default { appName: 'mts-app' };", 'mts-app'],
      ['zephyr.config.cts', "export default { appName: 'cts-app' };", 'cts-app'],
    ] as const;

    for (const [fileName, content, appName] of cases) {
      const caseRoot = join(root, fileName.replace(/\./g, '-'));
      const appDir = join(caseRoot, 'app');
      mkdirSync(appDir, { recursive: true });
      writeFileSync(join(caseRoot, fileName), content);

      expect(getZephyrConfig(appDir).app).toBe(appName);
    }
  });

  it('rejects non-canonical zephyr.config.ts aliases', () => {
    writeFileSync(
      join(root, 'zephyr.config.ts'),
      `export default ${JSON.stringify({
        organization: 'alias-org',
        parentOrganization: 'alias-parent',
        app: 'alias-app',
        name: 'alias-name',
        environment: { ZE_PUBLIC_ALIAS: 'alias' },
        zephyrDependencies: {
          alias: 'zephyr:alias.alias-project.alias-org@latest',
        },
        'zephyr:dependencies': {
          packageAlias: 'zephyr:pkg.pkg-project.pkg-org@latest',
        },
      })};`
    );

    expect(() => getZephyrConfig(root)).toThrow(
      /Invalid Zephyr config.*unknown fields: organization, parentOrganization, app, name, environment, zephyrDependencies, zephyr:dependencies/
    );
  });

  it('rejects invalid zephyr.config.ts field values', () => {
    writeFileSync(
      join(root, 'zephyr.config.ts'),
      `export default ${JSON.stringify({
        org: 123,
        env: {
          ZE_PUBLIC_API_URL: false,
        },
      })};`
    );

    expect(() => getZephyrConfig(root)).toThrow(/org must be a string/);
  });

  it('applies configured env vars without overwriting process env', () => {
    process.env['ZE_PUBLIC_API_URL'] = 'from-process';

    applyZephyrConfigEnv({
      env: {
        ZE_PUBLIC_API_URL: 'from-config',
        ZE_PUBLIC_OTHER: 'from-config',
      },
    });

    expect(process.env['ZE_PUBLIC_API_URL']).toBe('from-process');
    expect(process.env['ZE_PUBLIC_OTHER']).toBe('from-config');
  });
});
