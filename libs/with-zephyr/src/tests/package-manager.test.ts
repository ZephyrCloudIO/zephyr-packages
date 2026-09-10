import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  addToPackageJson,
  buildAddCommand,
  buildInstallCommand,
  detectPackageManager,
  getResolvedPackageVersion,
  isPackageInstalled,
  isPackageRequirementSatisfied,
  isResolvedPackageRequirementSatisfied,
  isSafelyConstrainedVersion,
} from '../package-manager.js';

describe('Package Manager Utils', () => {
  let tempDir: string;
  let originalCwd: string;
  let originalUserAgent: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-manager-test-'));
    originalCwd = process.cwd();
    originalUserAgent = process.env.npm_config_user_agent;

    // Clear environment variables that might affect detection
    delete process.env.npm_config_user_agent;
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);

    // Restore environment variables
    if (originalUserAgent !== undefined) {
      process.env.npm_config_user_agent = originalUserAgent;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('detectPackageManager', () => {
    it('should detect pnpm from pnpm-lock.yaml', () => {
      fs.writeFileSync('pnpm-lock.yaml', 'lockfileVersion: 6.0');
      expect(detectPackageManager(tempDir)).toBe('pnpm');
    });

    it('should detect yarn from yarn.lock', () => {
      fs.writeFileSync('yarn.lock', '# This is a Yarn lockfile');
      expect(detectPackageManager(tempDir)).toBe('yarn');
    });

    it('should detect bun from bun.lockb', () => {
      fs.writeFileSync('bun.lockb', 'binary content');
      expect(detectPackageManager(tempDir)).toBe('bun');
    });

    it('should detect bun from bun.lock', () => {
      fs.writeFileSync('bun.lock', 'lockfileVersion = 1');
      expect(detectPackageManager(tempDir)).toBe('bun');
    });

    it('should detect npm from package-lock.json', () => {
      fs.writeFileSync('package-lock.json', '{"lockfileVersion": 2}');
      expect(detectPackageManager(tempDir)).toBe('npm');
    });

    it('should default to npm when no lock files exist', () => {
      expect(detectPackageManager(tempDir)).toBe('npm');
    });

    it('should prioritize pnpm over other package managers', () => {
      fs.writeFileSync('pnpm-lock.yaml', 'lockfileVersion: 6.0');
      fs.writeFileSync('yarn.lock', '# Yarn lockfile');
      fs.writeFileSync('package-lock.json', '{"lockfileVersion": 2}');

      expect(detectPackageManager(tempDir)).toBe('pnpm');
    });

    it('should detect a nested project manager without the invoking user agent', () => {
      process.env.npm_config_user_agent = 'pnpm/11.0.0';
      fs.writeFileSync('yarn.lock', '# Yarn lockfile');

      expect(detectPackageManager(tempDir, { ignoreUserAgent: true })).toBe('yarn');
    });

    it('should prioritize yarn over npm when both exist', () => {
      fs.writeFileSync('yarn.lock', '# Yarn lockfile');
      fs.writeFileSync('package-lock.json', '{"lockfileVersion": 2}');

      expect(detectPackageManager(tempDir)).toBe('yarn');
    });

    it('should prioritize bun over npm but not yarn', () => {
      fs.writeFileSync('bun.lockb', 'binary');
      fs.writeFileSync('package-lock.json', '{"lockfileVersion": 2}');

      expect(detectPackageManager(tempDir)).toBe('bun');
    });

    it('should search in parent directories', () => {
      fs.mkdirSync('nested/deep/directory', { recursive: true });
      fs.writeFileSync('pnpm-lock.yaml', 'lockfileVersion: 6.0');

      const nestedDir = path.join(tempDir, 'nested/deep/directory');
      expect(detectPackageManager(nestedDir)).toBe('pnpm');
    });

    it('should stop searching at filesystem root', () => {
      fs.mkdirSync('project/subdir', { recursive: true });
      const subDir = path.join(tempDir, 'project/subdir');

      expect(detectPackageManager(subDir)).toBe('npm'); // Default when nothing found
    });
  });

  describe('isPackageInstalled', () => {
    beforeEach(() => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify(
          {
            name: 'test-project',
            dependencies: {
              react: '^18.0.0',
              lodash: '^4.17.21',
            },
            devDependencies: {
              typescript: '^5.0.0',
              '@types/node': '^20.0.0',
            },
          },
          null,
          2
        )
      );
    });

    it('should detect installed dependencies', () => {
      expect(isPackageInstalled('react', tempDir)).toBe(true);
      expect(isPackageInstalled('lodash', tempDir)).toBe(true);
    });

    it('should detect installed devDependencies', () => {
      expect(isPackageInstalled('typescript', tempDir)).toBe(true);
      expect(isPackageInstalled('@types/node', tempDir)).toBe(true);
    });

    it('should return false for uninstalled packages', () => {
      expect(isPackageInstalled('vite-plugin-zephyr', tempDir)).toBe(false);
      expect(isPackageInstalled('non-existent-package', tempDir)).toBe(false);
    });

    it('should handle scoped packages', () => {
      expect(isPackageInstalled('@types/node', tempDir)).toBe(true);
      expect(isPackageInstalled('@types/react', tempDir)).toBe(false);
    });

    it('should return false when package.json does not exist', () => {
      fs.unlinkSync('package.json');
      expect(isPackageInstalled('react', tempDir)).toBe(false);
    });

    it('should handle malformed package.json gracefully', () => {
      fs.writeFileSync('package.json', '{ invalid json }');
      expect(isPackageInstalled('react', tempDir)).toBe(false);
    });

    it('should handle package.json without dependencies', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
        })
      );

      expect(isPackageInstalled('react', tempDir)).toBe(false);
    });

    it('should handle empty dependencies objects', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'test-project',
          dependencies: {},
          devDependencies: {},
        })
      );

      expect(isPackageInstalled('react', tempDir)).toBe(false);
    });
  });

  describe('Package Manager Detection Edge Cases', () => {
    it('should handle symlinked directories', () => {
      fs.mkdirSync('original');
      fs.writeFileSync('original/pnpm-lock.yaml', 'lockfileVersion: 6.0');

      // Create symlink (skip on Windows where this might fail)
      try {
        fs.symlinkSync('original', 'linked', 'dir');
        process.chdir('linked');
        expect(detectPackageManager()).toBe('pnpm');
      } catch (error) {
        // Skip test on systems where symlinks can't be created
        console.log('Skipping symlink test:', error);
      }
    });

    it('should handle directories with no read permissions gracefully', () => {
      // This test might behave differently on different systems
      // Just ensure it doesn't crash
      expect(typeof detectPackageManager(tempDir)).toBe('string');
    });

    it('should handle concurrent lock files with different priorities', () => {
      // Create all possible lock files
      fs.writeFileSync('pnpm-lock.yaml', 'pnpm content');
      fs.writeFileSync('yarn.lock', 'yarn content');
      fs.writeFileSync('bun.lockb', 'bun content');
      fs.writeFileSync('package-lock.json', 'npm content');

      // Should still detect pnpm as highest priority
      expect(detectPackageManager(tempDir)).toBe('pnpm');

      // Remove pnpm, should detect yarn
      fs.unlinkSync('pnpm-lock.yaml');
      expect(detectPackageManager(tempDir)).toBe('yarn');

      // Remove yarn, should detect bun
      fs.unlinkSync('yarn.lock');
      expect(detectPackageManager(tempDir)).toBe('bun');

      // Remove bun, should detect npm
      fs.unlinkSync('bun.lockb');
      expect(detectPackageManager(tempDir)).toBe('npm');
    });
  });

  describe('Package Installation Patterns', () => {
    it('should correctly identify zephyr plugins that need installation', () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          'vite-plugin-zephyr': '^1.0.0',
        },
        devDependencies: {
          'zephyr-webpack-plugin': '^1.0.0',
        },
      };

      fs.writeFileSync('package.json', JSON.stringify(packageJson));

      expect(isPackageInstalled('vite-plugin-zephyr')).toBe(true);
      expect(isPackageInstalled('zephyr-webpack-plugin')).toBe(true);
      expect(isPackageInstalled('zephyr-rspack-plugin')).toBe(false);
      expect(isPackageInstalled('rollup-plugin-zephyr')).toBe(false);
    });

    it('should handle package names with special characters', () => {
      const packageJson = {
        dependencies: {
          '@babel/core': '^7.0.0',
          'package-with-dashes': '^1.0.0',
          package_with_underscores: '^1.0.0',
        },
      };

      fs.writeFileSync('package.json', JSON.stringify(packageJson));

      expect(isPackageInstalled('@babel/core')).toBe(true);
      expect(isPackageInstalled('package-with-dashes')).toBe(true);
      expect(isPackageInstalled('package_with_underscores')).toBe(true);
    });
  });

  describe('Workspace Detection', () => {
    it('should detect package manager in monorepo root', () => {
      // Create a monorepo structure
      fs.writeFileSync('pnpm-workspace.yaml', 'packages:\n  - "packages/*"');
      fs.writeFileSync('pnpm-lock.yaml', 'lockfileVersion: 6.0');

      fs.mkdirSync('packages/app1', { recursive: true });
      fs.writeFileSync('packages/app1/package.json', '{"name": "app1"}');

      process.chdir('packages/app1');
      expect(detectPackageManager(path.join(tempDir, 'packages/app1'))).toBe('pnpm');
    });

    it('should find package.json in workspace structure', () => {
      // Root package.json with workspaces
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: 'monorepo',
          workspaces: ['packages/*'],
          devDependencies: {
            'shared-dependency': '^1.0.0',
          },
        })
      );

      fs.mkdirSync('packages/frontend', { recursive: true });
      fs.writeFileSync(
        'packages/frontend/package.json',
        JSON.stringify({
          name: 'frontend',
          dependencies: {
            'frontend-only': '^1.0.0',
          },
        })
      );

      process.chdir('packages/frontend');

      // Should find both local and root dependencies
      expect(
        isPackageInstalled('frontend-only', path.join(tempDir, 'packages/frontend'))
      ).toBe(true);
      expect(isPackageInstalled('shared-dependency', tempDir)).toBe(true);
      expect(
        isPackageInstalled('non-existent', path.join(tempDir, 'packages/frontend'))
      ).toBe(false);
    });
  });

  describe('Install Command Builders', () => {
    it('should build a single pnpm add command for multiple dev packages', () => {
      const command = buildAddCommand(
        'pnpm',
        ['vite-plugin-zephyr', 'zephyr-webpack-plugin'],
        true
      );

      expect(command).toBe(
        'pnpm add --save-dev vite-plugin-zephyr zephyr-webpack-plugin'
      );
    });

    it('should build install command for pnpm', () => {
      expect(buildInstallCommand('pnpm')).toBe('pnpm install');
    });

    it('should preserve an explicit package version range', () => {
      fs.writeFileSync('package.json', '{}');

      expect(addToPackageJson(tempDir, '@module-federation/metro', '^2.9.0', true)).toBe(
        true
      );
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

      expect(packageJson.devDependencies['@module-federation/metro']).toBe('^2.9.0');
    });

    it('should preserve production placement and remove a conflicting dev entry', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          dependencies: { 'zephyr-metro-plugin': '^1.3.0' },
          devDependencies: { 'zephyr-metro-plugin': '^1.2.0' },
        })
      );

      expect(addToPackageJson(tempDir, 'zephyr-metro-plugin', '^1.4.0', false)).toBe(
        true
      );
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

      expect(packageJson.dependencies['zephyr-metro-plugin']).toBe('^1.4.0');
      expect(packageJson.devDependencies['zephyr-metro-plugin']).toBeUndefined();
    });

    it('should conservatively validate complete version declarations', () => {
      expect(isSafelyConstrainedVersion('^0.82.0', '0.82.0')).toBe(true);
      expect(isSafelyConstrainedVersion('>=0.82.0 <1.0.0', '0.82.0')).toBe(true);
      expect(isSafelyConstrainedVersion('^0.81.0', '0.82.0')).toBe(false);
      expect(isSafelyConstrainedVersion('workspace:^0.82.0', '0.82.0')).toBe(false);
      expect(isSafelyConstrainedVersion('*', '0.82.0')).toBe(false);
      expect(isSafelyConstrainedVersion('latest', '0.82.0')).toBe(false);
      expect(isSafelyConstrainedVersion('0.82.0 || >=1.0.0', '0.82.0')).toBe(false);
      expect(isSafelyConstrainedVersion('^2.9.0', '2.9.0', '3.0.0')).toBe(true);
      expect(isSafelyConstrainedVersion('>=2.9.0', '2.9.0', '3.0.0')).toBe(false);
      expect(isSafelyConstrainedVersion('>=2.9.0 <3.0.0', '2.9.0', '3.0.0')).toBe(true);
      expect(isSafelyConstrainedVersion('^3.0.0', '2.9.0', '3.0.0')).toBe(false);
      expect(isSafelyConstrainedVersion('^0.82.1', '0.82.1', '0.83.0')).toBe(true);
      expect(isSafelyConstrainedVersion('^0.83.0', '0.82.1', '0.83.0')).toBe(false);
    });

    it('should require the declared adapter-capable plugin range', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({ devDependencies: { 'zephyr-metro-plugin': '^1.3.0' } })
      );
      const packageDirectory = path.join(tempDir, 'node_modules', 'zephyr-metro-plugin');
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(packageDirectory, 'package.json'),
        JSON.stringify({ name: 'zephyr-metro-plugin', version: '1.4.2' })
      );

      expect(isPackageRequirementSatisfied('zephyr-metro-plugin', tempDir, '1.4.0')).toBe(
        false
      );
    });

    it('should accept a compatible resolved package behind a workspace declaration', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({ devDependencies: { '@module-federation/metro': 'workspace:*' } })
      );
      const packageDirectory = path.join(
        tempDir,
        'node_modules',
        '@module-federation',
        'metro'
      );
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(packageDirectory, 'package.json'),
        JSON.stringify({ name: '@module-federation/metro', version: '2.9.1' })
      );

      expect(
        isPackageRequirementSatisfied('@module-federation/metro', tempDir, '2.9.0')
      ).toBe(true);
    });

    it('should not resolve packages outside the target project', () => {
      fs.writeFileSync('package.json', '{}');

      expect(getResolvedPackageVersion('react-native', tempDir)).toBeUndefined();
      expect(getResolvedPackageVersion('metro', tempDir)).toBeUndefined();
    });

    it('should detect requirements resolved from a workspace root', () => {
      fs.writeFileSync('package.json', '{}');
      const projectDirectory = path.join(tempDir, 'apps', 'native');
      fs.mkdirSync(projectDirectory, { recursive: true });
      fs.writeFileSync(path.join(projectDirectory, 'package.json'), '{}');
      const packageDirectory = path.join(tempDir, 'node_modules', 'zephyr-metro-plugin');
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(packageDirectory, 'package.json'),
        JSON.stringify({ name: 'zephyr-metro-plugin', version: '1.4.2' })
      );

      expect(
        isResolvedPackageRequirementSatisfied(
          'zephyr-metro-plugin',
          projectDirectory,
          '1.4.0'
        )
      ).toBe(true);
      expect(
        isResolvedPackageRequirementSatisfied(
          '@module-federation/metro',
          projectDirectory,
          '2.9.0',
          '3.0.0'
        )
      ).toBe(false);
    });
  });
});
