/* eslint-disable @typescript-eslint/no-floating-promises */
import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('Zephyr Codemod CLI', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zephyr-codemod-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const runCodemod = (args = '', expectError = false) => {
    const cliPath = path.join(originalCwd, 'dist', 'index.js');
    try {
      const result = execSync(`node "${cliPath}" ${args} 2>&1`, {
        // Redirect stderr to stdout
        encoding: 'utf8',
        cwd: tempDir,
        env: {
          ...process.env,
          NO_COLOR: '1',
          FORCE_COLOR: undefined, // Remove FORCE_COLOR override
        }, // Disable colors for tests
      });
      return result;
    } catch (error: unknown) {
      if (expectError) {
        const execError = error as { stdout?: string; stderr?: string };
        return execError.stdout || execError.stderr || '';
      }
      throw error;
    }
  };

  describe('CLI Options', () => {
    it('should show help when --help is provided', () => {
      const output = runCodemod('--help');
      expect(output).toContain('Automatically add withZephyr plugin');
      expect(output).toContain('--dry-run');
      expect(output).toContain('--bundlers');
      expect(output).toContain('--bundlers');
    });

    it('should show version when --version is provided', () => {
      const output = runCodemod('--version');
      expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('File Detection', () => {
    it('should detect webpack config files', () => {
      fs.writeFileSync(
        'webpack.config.js',
        `
        module.exports = {
          entry: './src/index.js',
          plugins: []
        };
      `
      );

      const output = runCodemod('--dry-run');
      expect(output).toContain('Found 1 configuration file(s)');
      expect(output).toContain('webpack.config.js');
    });

    it('should detect multiple bundler configs', () => {
      fs.writeFileSync('webpack.config.js', 'module.exports = { plugins: [] };');
      fs.writeFileSync('vite.config.ts', 'export default { plugins: [] };');
      fs.writeFileSync('rollup.config.mjs', 'export default { plugins: [] };');

      const output = runCodemod('--dry-run');
      expect(output).toContain('Found 3 configuration file(s)');
      expect(output).toContain('webpack.config.js');
      expect(output).toContain('vite.config.ts');
      expect(output).toContain('rollup.config.mjs');
    });

    it('should ignore node_modules', () => {
      fs.mkdirSync('node_modules', { recursive: true });
      fs.writeFileSync('node_modules/webpack.config.js', 'module.exports = {};');
      fs.writeFileSync('webpack.config.js', 'module.exports = { plugins: [] };');

      const output = runCodemod('--dry-run');
      expect(output).toContain('Found 1 configuration file(s)');
      expect(output).not.toContain('node_modules');
    });
  });

  describe('Bundler Filtering', () => {
    beforeEach(() => {
      fs.writeFileSync('webpack.config.js', 'module.exports = { plugins: [] };');
      fs.writeFileSync('vite.config.ts', 'export default { plugins: [] };');
      fs.writeFileSync('rollup.config.mjs', 'export default { plugins: [] };');
    });

    it('should process only specified bundlers', () => {
      const output = runCodemod('--dry-run --bundlers webpack vite');
      expect(output).toContain('Found 2 configuration file(s)');
      expect(output).toContain('webpack.config.js');
      expect(output).toContain('vite.config.ts');
      expect(output).not.toContain('rollup.config.mjs');
    });

    it('should handle single bundler filter', () => {
      const output = runCodemod('--dry-run --bundlers webpack');
      expect(output).toContain('Found 1 configuration file(s)');
      expect(output).toContain('webpack.config.js');
      expect(output).not.toContain('vite.config.ts');
    });
  });

  describe('Dry Run Mode', () => {
    it('should not modify files in dry run mode', () => {
      const originalContent = `
        export default {
          plugins: [somePlugin()]
        };
      `;
      fs.writeFileSync('vite.config.js', originalContent);

      runCodemod('--dry-run');

      const content = fs.readFileSync('vite.config.js', 'utf8');
      expect(content).toBe(originalContent);
    });

    it('should show what would be changed', () => {
      fs.writeFileSync(
        'vite.config.js',
        `
        export default {
          plugins: [react()]
        };
      `
      );

      const output = runCodemod('--dry-run');
      expect(output).toContain('Dry run mode - no files will be modified');
      expect(output).toContain('✓ Added withZephyr to vite.config.js');
    });
  });

  describe('Next.js Vinext Scaffold', () => {
    it('should scaffold vite and wrangler config for Next.js apps', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify(
          {
            name: '@acme/next-app',
            dependencies: {
              next: '^15.0.0',
              vinext: '^0.0.4',
              '@vitejs/plugin-rsc': '^0.5.19',
            },
            devDependencies: {
              'vite-plugin-vinext-zephyr': '^0.1.11',
              '@cloudflare/vite-plugin': '^1.25.0',
              vite: '^7.3.1',
              wrangler: '^4.68.1',
            },
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start',
            },
          },
          null,
          2
        )
      );

      runCodemod('.');

      expect(fs.existsSync('vite.config.ts')).toBe(true);
      expect(fs.existsSync('wrangler.jsonc')).toBe(true);

      const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
      expect(viteConfig).toContain("import vinext from 'vinext';");
      expect(viteConfig).toContain(
        "import { withZephyr } from 'vite-plugin-vinext-zephyr';"
      );

      const wranglerConfig = fs.readFileSync('wrangler.jsonc', 'utf8');
      expect(wranglerConfig).toContain('"main": "vinext/server/app-router-entry"');
      expect(wranglerConfig).toContain('"name": "acme-next-app"');

      const updatedPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      expect(updatedPackageJson.type).toBe('module');
      expect(updatedPackageJson.scripts.dev).toBe('vinext dev');
      expect(updatedPackageJson.scripts.build).toBe('vinext build');
      expect(updatedPackageJson.scripts.start).toBe('vinext start');
    });
  });

  describe('Actual Transformations', () => {
    it('should transform webpack config with composePlugins', () => {
      const originalContent = `
        import { composePlugins, withNx } from '@nx/webpack';
        import { withReact } from '@nx/react';

        export default composePlugins(
          withNx(),
          withReact(),
          (config) => config
        );
      `;
      fs.writeFileSync('webpack.config.ts', originalContent);

      runCodemod('.');

      const content = fs.readFileSync('webpack.config.ts', 'utf8');
      expect(content).toContain('import { withZephyr } from "zephyr-webpack-plugin"');
      expect(content).toContain('withZephyr()');
      expect(content).toMatch(/withReact\(\),\s*withZephyr\(\),/);
    });

    it('should transform vite config', () => {
      const originalContent = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';

        export default defineConfig({
          plugins: [react()]
        });
      `;
      fs.writeFileSync('vite.config.ts', originalContent);

      runCodemod('.');

      const content = fs.readFileSync('vite.config.ts', 'utf8');
      expect(content).toContain('import { withZephyr } from "vite-plugin-zephyr"');
      expect(content).toContain('react(), withZephyr()');
    });

    it('should transform rollup array config', () => {
      const originalContent = `
        export default [{
          input: 'src/index.ts',
          plugins: [resolve(), babel()]
        }];
      `;
      fs.writeFileSync('rollup.config.js', originalContent);

      runCodemod('.');

      const content = fs.readFileSync('rollup.config.js', 'utf8');
      expect(content).toContain('import { withZephyr } from "rollup-plugin-zephyr"');
      expect(content).toContain('babel(), withZephyr()');
    });

    it('should transform rspack config with wrapper', () => {
      const originalContent = `
        export default {
          mode: 'development',
          entry: './src/index.js',
          plugins: []
        };
      `;
      fs.writeFileSync('rspack.config.js', originalContent);

      runCodemod('.');

      const content = fs.readFileSync('rspack.config.js', 'utf8');
      expect(content).toContain('import { withZephyr } from "zephyr-rspack-plugin"');
      expect(content).toContain('withZephyr()');
    });

    it('should transform rsbuild config with simple plugin', () => {
      const originalContent = `
        import { defineConfig } from '@rsbuild/core';
        import { pluginReact } from '@rsbuild/plugin-react';

        export default defineConfig({
          plugins: [pluginReact()]
        });
      `;
      fs.writeFileSync('rsbuild.config.ts', originalContent);

      runCodemod('.');

      const content = fs.readFileSync('rsbuild.config.ts', 'utf8');
      expect(content).toContain('import { withZephyr } from "zephyr-rsbuild-plugin"');
      expect(content).toContain('pluginReact(), withZephyr()');
      expect(content).toMatch(/output:\s*\{\s*assetPrefix:\s*["']auto["']\s*\}/);
    });

    it('should wrap rspack defineConfig exports instead of adding to plugins array', () => {
      const originalContent = `
        import { defineConfig } from "@rspack/cli";
        import { rspack } from "@rspack/core";

        export default defineConfig({
          plugins: [new rspack.HtmlRspackPlugin({ template: "./index.html" })]
        });
      `;
      fs.writeFileSync('rspack.config.ts', originalContent);

      runCodemod('.');

      const content = fs.readFileSync('rspack.config.ts', 'utf8');
      expect(content).toContain('import { withZephyr } from "zephyr-rspack-plugin"');
      expect(content).toContain('export default withZephyr()(defineConfig({');
      expect(content).not.toMatch(/plugins[^]]*withZephyr\(\)/);
    });
  });

  describe('Skip Already Configured', () => {
    it('should skip files that already have withZephyr', () => {
      fs.writeFileSync(
        'vite.config.js',
        `
        import { withZephyr } from 'vite-plugin-zephyr';
        export default withZephyr()({
          plugins: [react()]
        });
      `
      );

      const output = runCodemod('--dry-run');
      expect(output).toContain('Skipping vite.config.js (already has withZephyr)');
      expect(output).toContain('✓ Processed: 0');
      expect(output).toContain('⏭️ Skipped: 1');
    });

    it('should skip conditional repack configs', () => {
      fs.writeFileSync(
        'rspack.config.mjs',
        `
        const config = env => ({ mode: 'development' });
        export default USE_ZEPHYR ? withZephyr()(config) : config;
      `
      );

      const output = runCodemod('--dry-run');
      expect(output).toContain('Skipping rspack.config.mjs (already has withZephyr)');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed config files gracefully', () => {
      fs.writeFileSync('webpack.config.js', 'this is not valid javascript {');

      const output = runCodemod('--dry-run');
      expect(output).toContain('✗ Errors: 1');
      expect(output).toContain('Error transforming webpack.config.js');
    });

    it('should continue processing other files when one fails', () => {
      fs.writeFileSync('webpack.config.js', 'invalid syntax {');
      fs.writeFileSync('vite.config.js', 'export default { plugins: [] };');

      const output = runCodemod('--dry-run');
      expect(output).toContain('✓ Processed: 1');
      expect(output).toContain('✗ Errors: 1');
      expect(output).toContain('Error transforming webpack.config.js');
      expect(output).toContain('✓ Added withZephyr to vite.config.js');
    });
  });

  describe('Package Installation Hints', () => {
    it('should suggest package installation', () => {
      fs.writeFileSync('vite.config.js', 'export default { plugins: [] };');
      fs.writeFileSync('webpack.config.js', 'module.exports = { plugins: [] };');

      const output = runCodemod('--dry-run');
      expect(output).toContain('📦 Packages that would be installed:');
      expect(output).toContain('vite-plugin-zephyr');
      expect(output).toContain('zephyr-webpack-plugin');
    });

    it('should not show installation hint when no files processed', () => {
      fs.writeFileSync(
        'vite.config.js',
        `
        import { withZephyr } from 'vite-plugin-zephyr';
        export default withZephyr()({ plugins: [] });
      `
      );

      const output = runCodemod('--dry-run');
      expect(output).not.toContain('📦 Packages that would be installed');
    });
  });

  describe('Directory Targeting', () => {
    it('should work with specific directory', () => {
      fs.mkdirSync('subdir');
      fs.writeFileSync('subdir/vite.config.js', 'export default { plugins: [] };');
      fs.writeFileSync('webpack.config.js', 'module.exports = { plugins: [] };');

      const output = runCodemod('subdir --dry-run');
      expect(output).toContain('Found 1 configuration file(s)');
      expect(output).toContain('subdir/vite.config.js');
      expect(output).not.toContain('webpack.config.js');
    });

    it('should handle nested directories', () => {
      fs.mkdirSync('apps/frontend', { recursive: true });
      fs.mkdirSync('apps/backend', { recursive: true });
      fs.writeFileSync('apps/frontend/vite.config.ts', 'export default { plugins: [] };');
      fs.writeFileSync(
        'apps/backend/webpack.config.js',
        'module.exports = { plugins: [] };'
      );

      const output = runCodemod('--dry-run');
      expect(output).toContain('Found 2 configuration file(s)');
      expect(output).toContain('apps/frontend/vite.config.ts');
      expect(output).toContain('apps/backend/webpack.config.js');
    });
  });

  describe('Output Formatting', () => {
    it('should provide clear success summary', () => {
      fs.writeFileSync('vite.config.js', 'export default { plugins: [] };');
      fs.writeFileSync('webpack.config.js', 'module.exports = { plugins: [] };');

      const output = runCodemod('--dry-run');
      expect(output).toContain(
        '🚀 Zephyr Codemod - Adding withZephyr to bundler configs'
      );
      expect(output).toContain('Found 2 configuration file(s)');
      expect(output).toContain('Summary:');
      expect(output).toContain('✓ Processed: 2');
      expect(output).toContain('⏭️ Skipped: 0');
      expect(output).toContain('✗ Errors: 0');
    });

    it('should show processing details', () => {
      fs.writeFileSync('vite.config.js', 'export default { plugins: [] };');

      const output = runCodemod('--dry-run');
      expect(output).toContain('Processing vite config: vite.config.js');
      expect(output).toContain('✓ Added withZephyr to vite.config.js');
    });
  });
});
