import { describe, expect, it } from '@jest/globals';
import type { ZePackageJson } from '../build-context/ze-package-json.type';
import { resolveZephyrPluginPackageName } from './plugin-package-name';

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

  it('does not throw for unknown runtime builder values', () => {
    const packageJson = {
      name: 'app',
      version: '1.0.0',
    } satisfies ZePackageJson;

    const pluginPackageName = resolveZephyrPluginPackageName(packageJson, 'elysia-app');

    expect(pluginPackageName).toBe('zephyr-packages');
  });
});
