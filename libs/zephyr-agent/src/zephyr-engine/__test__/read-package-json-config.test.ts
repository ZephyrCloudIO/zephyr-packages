import { afterEach, describe, expect, it } from '@rstest/core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPackageJson } from '../index';

describe('readPackageJson config remotes', () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { force: true, recursive: true });
    root = undefined;
  });

  it('uses config entries over package entries while retaining package-only remotes', () => {
    root = mkdtempSync(join(tmpdir(), 'zephyr-package-config-'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'configured-app',
        'zephyr:dependencies': {
          shared: 'package-version',
          packageOnly: 'package-only-version',
        },
      })
    );

    expect(
      readPackageJson(root, {
        remoteDependencies: {
          shared: 'config-version',
          configOnly: 'config-only-version',
        },
      }).zephyrDependencies
    ).toEqual({
      shared: 'config-version',
      packageOnly: 'package-only-version',
      configOnly: 'config-only-version',
    });
  });
});
