import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { resolveCatalogDependencies } from './metro-build-stats';

describe('resolveCatalogDependencies', () => {
  it('resolves default and named catalogs from the nearest workspace', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'zephyr-catalogs-'));
    const application = join(workspace, 'examples', 'application');

    mkdirSync(application, { recursive: true });
    writeFileSync(
      join(workspace, 'pnpm-workspace.yaml'),
      [
        'catalog:',
        '  react: ^19.2.7',
        'catalogs:',
        '  tooling:',
        '    typescript: ~5.9.3',
      ].join('\n')
    );

    expect(
      resolveCatalogDependencies(
        {
          react: 'catalog:',
          typescript: 'catalog:tooling',
          vite: '^8.1.4',
        },
        application
      )
    ).toEqual({
      react: '^19.2.7',
      typescript: '~5.9.3',
      vite: '^8.1.4',
    });
  });

  it('preserves unresolved catalog references instead of inventing a version', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zephyr-no-catalogs-'));

    expect(
      resolveCatalogDependencies(
        {
          react: 'catalog:',
          typescript: 'catalog:tooling',
        },
        directory
      )
    ).toEqual({
      react: 'catalog:',
      typescript: 'catalog:tooling',
    });
  });
});
