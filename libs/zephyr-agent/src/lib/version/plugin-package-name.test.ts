import * as actualFs from 'node:fs' with { rstest: 'importActual' };
import { afterEach, describe, expect, it, rs } from '@rstest/core';

const fsState = rs.hoisted(() => ({ packageJsonUnreadable: false }));

// The test runner's require ignores `paths`, so every workspace package resolves here.
// Simulate a project without the plugin installed by making its package.json unreadable.
rs.mock('node:fs', () => ({
  ...actualFs,
  readFileSync: ((...args: Parameters<typeof actualFs.readFileSync>) => {
    if (fsState.packageJsonUnreadable) throw new Error('ENOENT');
    return actualFs.readFileSync(...args);
  }) as typeof actualFs.readFileSync,
}));

import type { ZePackageJson } from '../build-context/ze-package-json.type';
import {
  resolveInstalledPackageVersion,
  resolveZephyrPluginIdentity,
  resolveZephyrPluginPackageName,
} from './plugin-package-name';

describe('plugin-package-name', () => {
  it('resolves plugin package from declared dependencies', () => {
    const packageJson = {
      name: 'app',
      version: '1.0.0',
      devDependencies: {
        'vite-plugin-vinext-zephyr': '^1.0.0',
      },
    } satisfies ZePackageJson;

    const pluginPackageName = resolveZephyrPluginPackageName(packageJson, 'vite');

    expect(pluginPackageName).toBe('vite-plugin-vinext-zephyr');
  });

  it('falls back to builder default when no known plugin is declared', () => {
    const packageJson = {
      name: 'app',
      version: '1.0.0',
      devDependencies: {
        vite: '^6.0.0',
      },
    } satisfies ZePackageJson;

    const pluginPackageName = resolveZephyrPluginPackageName(packageJson, 'rollup');

    expect(pluginPackageName).toBe('rollup-plugin-zephyr');
  });

  it('keeps Rolldown diagnostics attached to the Rolldown adapter', () => {
    const packageJson = {
      name: 'app',
      version: '1.0.0',
      devDependencies: {
        rolldown: '^1.0.0',
      },
    } satisfies ZePackageJson;

    expect(resolveZephyrPluginPackageName(packageJson, 'rolldown')).toBe(
      'zephyr-rolldown-plugin'
    );
  });

  it('does not throw for unknown runtime builder values', () => {
    const packageJson = {
      name: 'app',
      version: '1.0.0',
    } satisfies ZePackageJson;

    const pluginPackageName = resolveZephyrPluginPackageName(packageJson, 'elysia-app');

    expect(pluginPackageName).toBe('zephyr-packages');
  });

  describe('resolveZephyrPluginIdentity', () => {
    afterEach(() => {
      fsState.packageJsonUnreadable = false;
    });

    it('names a declared plugin even when its version cannot be read', () => {
      fsState.packageJsonUnreadable = true;
      const packageJson = {
        name: 'app',
        version: '1.0.0',
        devDependencies: { 'zephyr-astro-integration': '^1.0.0' },
      } satisfies ZePackageJson;

      expect(resolveZephyrPluginIdentity(packageJson, 'astro')).toEqual({
        name: 'zephyr-astro-integration',
      });
    });

    it('reports nothing rather than a guessed plugin name', () => {
      fsState.packageJsonUnreadable = true;
      const packageJson = {
        name: 'app',
        version: '1.0.0',
        devDependencies: { rollup: '^4.0.0' },
      } satisfies ZePackageJson;

      expect(resolveZephyrPluginIdentity(packageJson, 'rollup')).toEqual({});
      expect(resolveZephyrPluginIdentity(packageJson, 'not-a-builder')).toEqual({});
    });
  });

  describe('resolveInstalledPackageVersion', () => {
    it('names an installed plugin with its version', () => {
      const packageJson = {
        name: 'app',
        version: '1.0.0',
        devDependencies: { 'zephyr-astro-integration': 'workspace:*' },
      } satisfies ZePackageJson;

      // This workspace has the plugin installed.
      expect(resolveZephyrPluginIdentity(packageJson, 'astro')).toEqual({
        name: 'zephyr-astro-integration',
        version: expect.stringMatching(/^\d+\.\d+/),
      });
    });

    it('reads the version of an installed package', () => {
      expect(resolveInstalledPackageVersion('zephyr-edge-contract')).toMatch(/^\d+\.\d+/);
    });

    it('returns undefined for a package that is not installed', () => {
      expect(resolveInstalledPackageVersion('__not-installed-zephyr-plugin__')).toBe(
        undefined
      );
    });
  });
});
