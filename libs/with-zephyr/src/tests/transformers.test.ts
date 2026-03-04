/* eslint-disable @typescript-eslint/no-floating-promises */
import { beforeEach, describe, expect, it } from '@rstest/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  applyBundlerOperations,
  hasZephyrCall,
  runBundlerOperation,
} from '../operations.js';
import type { BundlerConfig, BundlerOperationId, BundlerStrategy } from '../types.js';

function createConfig(
  operation: BundlerOperationId,
  strategy: BundlerStrategy = 'first-success',
  plugin = 'vite-plugin-zephyr'
): BundlerConfig {
  return {
    files: [],
    plugin,
    importName: plugin === 'parcel-reporter-zephyr' ? null : 'withZephyr',
    strategy,
    operations: [operation],
  };
}

describe('Ast-grep Operations', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zephyr-ops-test-'));
  });

  describe('hasZephyrCall', () => {
    it('should detect withZephyr call expression', () => {
      const filePath = path.join(tempDir, 'vite.config.ts');
      fs.writeFileSync(
        filePath,
        `
        import { withZephyr } from 'vite-plugin-zephyr';
        export default withZephyr()({ plugins: [] });
      `
      );

      const result = hasZephyrCall(filePath);
      expect(result.status).toBe('changed');
    });

    it('should return no-match when withZephyr call does not exist', () => {
      const filePath = path.join(tempDir, 'vite.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default { plugins: [] };
      `
      );

      const result = hasZephyrCall(filePath);
      expect(result.status).toBe('no-match');
    });
  });

  describe('compose-plugins', () => {
    it('should inject withZephyr before terminal config function', () => {
      const filePath = path.join(tempDir, 'webpack.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default composePlugins(
          withNx(),
          withReact(),
          (config) => config
        );
      `
      );

      const result = runBundlerOperation('compose-plugins', {
        filePath,
        config: createConfig('compose-plugins', 'first-success', 'zephyr-webpack-plugin'),
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toMatch(/withReact\(\),\s*withZephyr\(\),\s*\(config\) => config/);
    });
  });

  describe('plugins-array operations', () => {
    it('should append withZephyr to existing plugins array', () => {
      const filePath = path.join(tempDir, 'vite.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default defineConfig({
          plugins: [react()]
        });
      `
      );

      const result = runBundlerOperation('plugins-array', {
        filePath,
        config: createConfig('plugins-array'),
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toContain('plugins: [react(), withZephyr()]');
    });

    it('should create plugins array when using plugins-array-or-create', () => {
      const filePath = path.join(tempDir, 'modern.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default defineConfig({
          source: { alias: {} }
        });
      `
      );

      const result = runBundlerOperation('plugins-array-or-create', {
        filePath,
        config: createConfig(
          'plugins-array-or-create',
          'first-success',
          'zephyr-modernjs-plugin'
        ),
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toContain('plugins: [withZephyr()]');
    });
  });

  describe('astro integrations operations', () => {
    it('should append withZephyr to integrations when defineConfig has other properties', () => {
      const filePath = path.join(tempDir, 'astro.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default defineConfig({
          site: 'https://example.com',
          integrations: [mdx(), sitemap()],
        });
      `
      );

      const result = runBundlerOperation('astro-integrations-or-create', {
        filePath,
        config: createConfig(
          'astro-integrations-or-create',
          'first-success',
          'zephyr-astro-integration'
        ),
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toContain('integrations: [mdx(), sitemap(), withZephyr()]');
      expect(next.match(/integrations:\s*\[/g)?.length ?? 0).toBe(1);
    });

    it('should not create duplicate integrations when using astro operation chain', () => {
      const filePath = path.join(tempDir, 'astro.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default defineConfig({
          site: 'https://example.com',
          integrations: [mdx(), sitemap()],
        });
      `
      );

      const config: BundlerConfig = {
        files: [],
        plugin: 'zephyr-astro-integration',
        importName: 'withZephyr',
        strategy: 'first-success',
        operations: [
          'astro-integrations-function-or-create',
          'astro-integrations-or-create',
        ],
      };

      const result = applyBundlerOperations({
        filePath,
        config,
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toContain('integrations: [mdx(), sitemap(), withZephyr()]');
      expect(next).not.toContain('],,');
      expect(next.match(/integrations:\s*\[/g)?.length ?? 0).toBe(1);
    });

    it('should append withZephyr for defineConfig arrow function integrations', () => {
      const filePath = path.join(tempDir, 'astro.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default defineConfig((env) => ({
          site: env.site,
          integrations: [mdx(), sitemap()],
        }));
      `
      );

      const config: BundlerConfig = {
        files: [],
        plugin: 'zephyr-astro-integration',
        importName: 'withZephyr',
        strategy: 'first-success',
        operations: [
          'astro-integrations-function-or-create',
          'astro-integrations-or-create',
        ],
      };

      const result = applyBundlerOperations({
        filePath,
        config,
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toContain('integrations: [mdx(), sitemap(), withZephyr()]');
      expect(next.match(/integrations:\s*\[/g)?.length ?? 0).toBe(1);
    });
  });

  describe('wrappers', () => {
    it('should wrap export default defineConfig for rspack', () => {
      const filePath = path.join(tempDir, 'rspack.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default defineConfig({
          plugins: [new rspack.HtmlRspackPlugin()]
        });
      `
      );

      const result = runBundlerOperation('wrap-export-default-define-config', {
        filePath,
        config: createConfig(
          'wrap-export-default-define-config',
          'first-success',
          'zephyr-rspack-plugin'
        ),
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toContain('export default withZephyr()(defineConfig(');
    });

    it('should wrap exported function reference for repack', () => {
      const filePath = path.join(tempDir, 'rspack.config.mjs');
      fs.writeFileSync(
        filePath,
        `
        const config = env => ({ mode: env.mode });
        export default config;
      `
      );

      const result = runBundlerOperation('wrap-exported-function', {
        filePath,
        config: createConfig(
          'wrap-exported-function',
          'first-success',
          'zephyr-repack-plugin'
        ),
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toContain('export default withZephyr()(config);');
    });
  });

  describe('rsbuild-asset-prefix', () => {
    it('should add output.assetPrefix = "auto" when missing', () => {
      const filePath = path.join(tempDir, 'rsbuild.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default defineConfig({
          plugins: [pluginReact()]
        });
      `
      );

      const result = runBundlerOperation('rsbuild-asset-prefix', {
        filePath,
        config: createConfig('rsbuild-asset-prefix', 'run-all', 'zephyr-rsbuild-plugin'),
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toMatch(/assetPrefix:\s*["']auto["']/);
    });

    it('should not overwrite existing output.assetPrefix', () => {
      const filePath = path.join(tempDir, 'rsbuild.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default defineConfig({
          output: { assetPrefix: '/static/' }
        });
      `
      );

      const result = runBundlerOperation('rsbuild-asset-prefix', {
        filePath,
        config: createConfig('rsbuild-asset-prefix', 'run-all', 'zephyr-rsbuild-plugin'),
        dryRun: false,
      });

      expect(result.status).toBe('no-match');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toContain("assetPrefix: '/static/'");
      expect(next).not.toContain('assetPrefix: "auto"');
    });
  });

  describe('parcel-reporters', () => {
    it('should append reporter once', () => {
      const filePath = path.join(tempDir, '.parcelrc.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify(
          {
            reporters: ['...'],
          },
          null,
          2
        )
      );

      const config = createConfig(
        'parcel-reporters',
        'run-all',
        'parcel-reporter-zephyr'
      );

      const first = runBundlerOperation('parcel-reporters', {
        filePath,
        config,
        dryRun: false,
      });
      const second = runBundlerOperation('parcel-reporters', {
        filePath,
        config,
        dryRun: false,
      });

      expect(first.status).toBe('changed');
      expect(second.status).toBe('no-match');

      const next = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
        reporters: string[];
      };
      expect(next.reporters).toContain('parcel-reporter-zephyr');
      expect(next.reporters.filter((r) => r === 'parcel-reporter-zephyr').length).toBe(1);
    });
  });

  describe('applyBundlerOperations', () => {
    it('should honor first-success strategy', () => {
      const filePath = path.join(tempDir, 'webpack.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default composePlugins(withNx(), withReact(), (config) => config);
      `
      );

      const config: BundlerConfig = {
        files: [],
        plugin: 'zephyr-webpack-plugin',
        importName: 'withZephyr',
        strategy: 'first-success',
        operations: ['compose-plugins', 'plugins-array'],
      };

      const result = applyBundlerOperations({
        filePath,
        config,
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toContain('withZephyr()');
      expect(next).not.toContain('plugins: [withZephyr()]');
    });

    it('should run all operations for run-all strategy', () => {
      const filePath = path.join(tempDir, 'rsbuild.config.ts');
      fs.writeFileSync(
        filePath,
        `
        export default defineConfig({
          html: { template: './index.html' }
        });
      `
      );

      const config: BundlerConfig = {
        files: [],
        plugin: 'zephyr-rsbuild-plugin',
        importName: 'withZephyr',
        strategy: 'run-all',
        operations: ['plugins-array-or-create', 'rsbuild-asset-prefix'],
      };

      const result = applyBundlerOperations({
        filePath,
        config,
        dryRun: false,
      });

      expect(result.status).toBe('changed');
      const next = fs.readFileSync(filePath, 'utf8');
      expect(next).toContain('plugins: [withZephyr()]');
      expect(next).toMatch(/assetPrefix:\s*["']auto["']/);
    });
  });
});
