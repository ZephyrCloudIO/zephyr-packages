import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('Zephyr Codemod CLI', () => {
  let tempDir: string;
  let originalCwd: string;
  let packageRoot: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zephyr-codemod-test-'));
    originalCwd = process.cwd();
    packageRoot = fs.existsSync(path.join(originalCwd, 'libs/with-zephyr/package.json'))
      ? path.join(originalCwd, 'libs/with-zephyr')
      : originalCwd;
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const runCodemod = (args = '', expectError = false, env: NodeJS.ProcessEnv = {}) => {
    const cliPath = path.join(packageRoot, 'dist', 'index.js');
    try {
      const result = execSync(`"${process.execPath}" "${cliPath}" ${args} 2>&1`, {
        // Redirect stderr to stdout
        encoding: 'utf8',
        cwd: tempDir,
        env: {
          ...process.env,
          NO_COLOR: '1',
          FORCE_COLOR: undefined, // Remove FORCE_COLOR override
          ...env,
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
  const compatibleMetroPeers = {
    '@babel/types': '^7.25.0',
    react: '^19.0.0',
    metro: '^0.82.1',
    'metro-config': '^0.82.1',
    'metro-file-map': '^0.82.1',
    'metro-resolver': '^0.82.1',
    'metro-source-map': '^0.82.1',
  };

  const writeResolvedMetroCompanions = (directory = tempDir) => {
    for (const [packageName, version] of [
      ['zephyr-metro-plugin', '1.4.2'],
      ['@module-federation/metro', '2.9.1'],
    ]) {
      const packageDirectory = path.join(
        directory,
        'node_modules',
        ...packageName.split('/')
      );
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(packageDirectory, 'package.json'),
        JSON.stringify({ name: packageName, version })
      );
    }
  };

  describe('CLI Options', () => {
    it('should show help when --help is provided', () => {
      const output = runCodemod('--help');
      expect(output).toContain('Automatically add Zephyr integration');
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
      expect(output).toContain('✓ Added Zephyr integration to vite.config.js');
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
              vite: '^8.1.4',
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

    it('should move existing declarations to their required dependency sections', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          name: '@acme/next-app',
          packageManager: 'pnpm@11.0.0',
          dependencies: {
            next: '^15.0.0',
            vite: '^8.1.4',
          },
          devDependencies: {
            vinext: 'workspace:*',
            '@vitejs/plugin-rsc': '0.5.19',
            'vite-plugin-vinext-zephyr': 'catalog:',
            '@cloudflare/vite-plugin': 'catalog:',
            vite: 'catalog:',
            wrangler: 'catalog:',
          },
        })
      );
      const fakeBin = path.join(tempDir, 'fake-bin');
      fs.mkdirSync(fakeBin);
      const fakeScript = path.join(fakeBin, 'fake-pnpm.js');
      fs.writeFileSync(fakeScript, 'process.exit(0);\n');
      const fakePnpm = path.join(fakeBin, 'pnpm');
      fs.writeFileSync(fakePnpm, `#!/bin/sh\n"${process.execPath}" "${fakeScript}"\n`);
      fs.chmodSync(fakePnpm, 0o755);
      fs.writeFileSync(
        path.join(fakeBin, 'pnpm.cmd'),
        `@"${process.execPath}" "${fakeScript}"\r\n`
      );

      runCodemod('.', false, {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        npm_config_user_agent: 'pnpm/11.0.0',
      });
      const updatedPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

      expect(updatedPackageJson.dependencies.vinext).toBe('workspace:*');
      expect(updatedPackageJson.devDependencies.vinext).toBeUndefined();
      expect(updatedPackageJson.dependencies['@vitejs/plugin-rsc']).toBe('0.5.19');
      expect(updatedPackageJson.devDependencies['@vitejs/plugin-rsc']).toBeUndefined();
      expect(updatedPackageJson.devDependencies.vite).toBe('catalog:');
      expect(updatedPackageJson.dependencies.vite).toBeUndefined();
    });
  });

  describe('Slidev Scaffold', () => {
    it('should scaffold vite config and package metadata for Slidev apps', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify(
          {
            name: 'slidev-app',
            private: true,
            dependencies: {
              '@slidev/cli': '^52.14.1',
            },
          },
          null,
          2
        )
      );

      runCodemod('.');

      expect(fs.existsSync('vite.config.ts')).toBe(true);

      const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
      expect(viteConfig).toContain("import { withZephyr } from 'vite-plugin-zephyr';");
      expect(viteConfig).toContain('plugins: [withZephyr()]');

      const updatedPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      expect(updatedPackageJson.name).toBe('slidev-app');
      expect(updatedPackageJson.version).toBe('1.0.0');
    });

    it('should report Slidev scaffold actions in dry run mode', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify(
          {
            private: true,
            devDependencies: {
              '@slidev/cli': '^52.14.1',
            },
          },
          null,
          2
        )
      );

      const output = runCodemod('--dry-run');

      expect(output).toContain('Would create vite.config.ts for Slidev');
      expect(output).toContain(
        'Would update package.json name/version for Zephyr compatibility'
      );
      expect(output).toContain('vite-plugin-zephyr');
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

    it('should transform vite config with a trailing comma in plugins array', () => {
      const originalContent = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';

        export default defineConfig({
          plugins: [react(),],
        });
      `;
      fs.writeFileSync('vite.config.ts', originalContent);

      runCodemod('.');

      const content = fs.readFileSync('vite.config.ts', 'utf8');
      expect(content).toContain('import { withZephyr } from "vite-plugin-zephyr"');
      expect(content).toContain('plugins: [react(), withZephyr()]');
      expect(content).not.toContain(',,');
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

    it('should transform metro config with async wrapper', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({ devDependencies: { 'zephyr-metro-plugin': '^1.4.0' } })
      );
      const originalContent = `
        const { getDefaultConfig } = require('@react-native/metro-config');
        module.exports = getDefaultConfig(__dirname);
      `;
      fs.writeFileSync('metro.config.js', originalContent);

      runCodemod('.');

      const content = fs.readFileSync('metro.config.js', 'utf8');
      expect(content).toContain('const { withZephyr } = require("zephyr-metro-plugin");');
      expect(content).toContain(
        'const __zephyrConfig = await getDefaultConfig(__dirname);'
      );
      expect(content).toContain(
        'return withZephyr()(typeof __zephyrConfig === "function" ? await __zephyrConfig() : __zephyrConfig);'
      );
    });

    it('should transform metro ESM config with async wrapper', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({ devDependencies: { 'zephyr-metro-plugin': '^1.4.0' } })
      );
      const originalContent = `
        export default {
          resolver: { sourceExts: ['js', 'ts'] }
        };
      `;
      fs.writeFileSync('metro.config.mjs', originalContent);

      runCodemod('.');

      const content = fs.readFileSync('metro.config.mjs', 'utf8');
      expect(content).toContain('import { withZephyr } from "zephyr-metro-plugin";');
      expect(content).toContain('export default (async () => {');
      expect(content).toContain(
        'return withZephyr()(typeof __zephyrConfig === "function" ? await __zephyrConfig() : __zephyrConfig);'
      );
    });

    it('should bootstrap React Native CLI publication commands', () => {
      writeResolvedMetroCompanions();
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          dependencies: { 'react-native': '^0.79.0' },
          devDependencies: {
            '@react-native-community/cli': '^19.0.0',
            '@module-federation/metro': '^2.9.0',
            ...compatibleMetroPeers,
            'zephyr-metro-plugin': '^1.4.0',
          },
        })
      );
      fs.writeFileSync(
        'metro.config.js',
        `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
      );

      const output = runCodemod();
      const cliConfig = fs.readFileSync('react-native.config.js', 'utf8');

      expect(output).toContain('Created react-native.config.js');
      expect(output).toContain(
        'Publish the first bundle with: npx react-native bundle-mf-remote --platform <platform> --dev false'
      );
      expect(cliConfig).toContain('module.exports = zephyrMetroReactNativeCli()');
    });

    it('should not print federation guidance after a successful Metro rerun', () => {
      writeResolvedMetroCompanions();
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          dependencies: { 'react-native': '^0.79.0' },
          devDependencies: {
            '@react-native-community/cli': '^19.0.0',
            '@module-federation/metro': '^2.9.0',
            ...compatibleMetroPeers,
            'zephyr-metro-plugin': '^1.4.0',
          },
        })
      );
      fs.writeFileSync(
        'metro.config.js',
        `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
      );

      expect(runCodemod()).toContain('Created react-native.config.js');
      const output = runCodemod();

      expect(output).toContain(
        'Skipping metro.config.js (already has Zephyr integration)'
      );
      expect(output).not.toContain('is not verifiably configured');
      expect(output).not.toContain('Companion command config was left unchanged');
    });

    it('should bootstrap every unique nested Metro project', () => {
      fs.writeFileSync('package.json', JSON.stringify({ private: true }));
      const fakeBin = path.join(tempDir, 'fake-bin');
      fs.mkdirSync(fakeBin);
      const fakeScript = path.join(fakeBin, 'fake-pnpm.js');
      fs.writeFileSync(
        fakeScript,
        `const fs = require("node:fs"); const path = require("node:path"); if (["host", "remote"].includes(path.basename(process.cwd()))) { for (const [name, version] of [["zephyr-metro-plugin", "1.4.2"], ["@module-federation/metro", "2.9.1"]]) { const dir = path.join(process.cwd(), "node_modules", ...name.split("/")); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version })); } }\n`
      );
      const fakePnpm = path.join(fakeBin, 'pnpm');
      fs.writeFileSync(fakePnpm, `#!/bin/sh\n"${process.execPath}" "${fakeScript}"\n`);
      fs.chmodSync(fakePnpm, 0o755);
      fs.writeFileSync(
        path.join(fakeBin, 'pnpm.cmd'),
        `@"${process.execPath}" "${fakeScript}"\r\n`
      );
      for (const project of ['apps/host', 'apps/remote']) {
        fs.mkdirSync(project, { recursive: true });
        fs.writeFileSync(
          path.join(project, 'package.json'),
          JSON.stringify({
            packageManager: 'pnpm@11.0.0',
            dependencies: { 'react-native': '^0.79.0' },
            devDependencies: {
              '@react-native-community/cli': '^19.0.0',
              ...compatibleMetroPeers,
            },
          })
        );
        fs.writeFileSync(
          path.join(project, 'metro.config.js'),
          `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
        );
      }

      const output = runCodemod('', false, {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        npm_config_user_agent: 'pnpm/11.0.0',
      });

      expect(output).toContain('Created apps/host/react-native.config.js');
      expect(output).toContain('Created apps/remote/react-native.config.js');
      expect(output).toContain(
        'Publish the first bundle with: cd "apps/host" && npx react-native bundle-mf-remote --platform <platform> --dev false'
      );
      expect(output).toContain(
        'Publish the first bundle with: cd "apps/remote" && npx react-native bundle-mf-remote --platform <platform> --dev false'
      );
      expect(fs.existsSync('apps/host/react-native.config.js')).toBe(true);
      expect(fs.existsSync('apps/remote/react-native.config.js')).toBe(true);
      for (const project of ['apps/host', 'apps/remote']) {
        const packageJson = JSON.parse(
          fs.readFileSync(path.join(project, 'package.json'), 'utf8')
        );
        expect(packageJson.devDependencies['zephyr-metro-plugin']).toBe('^1.4.0');
        expect(packageJson.devDependencies['@module-federation/metro']).toBe('^2.9.0');
      }
      const rootPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      expect(rootPackageJson.devDependencies).toBeUndefined();
    });

    it('should transform nuxt config by appending zephyr-nuxt-module', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({ devDependencies: { 'zephyr-nuxt-module': '^1.3.0' } })
      );
      const originalContent = `
        export default defineNuxtConfig({
          modules: ['nitro-cloudflare-dev']
        });
      `;
      fs.writeFileSync('nuxt.config.ts', originalContent);

      runCodemod('.');

      const content = fs.readFileSync('nuxt.config.ts', 'utf8');
      expect(content).not.toContain('import { withZephyr }');
      expect(content).toContain(
        'modules: [\'nitro-cloudflare-dev\', "zephyr-nuxt-module"]'
      );
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
      expect(output).toContain(
        'Skipping vite.config.js (already has Zephyr integration)'
      );
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
      expect(output).toContain(
        'Skipping rspack.config.mjs (already has Zephyr integration)'
      );
    });

    it('should skip nuxt config when zephyr-nuxt-module is already present', () => {
      fs.writeFileSync(
        'nuxt.config.ts',
        `
        export default defineNuxtConfig({
          modules: ['zephyr-nuxt-module']
        });
      `
      );

      const output = runCodemod('--dry-run');
      expect(output).toContain(
        'Skipping nuxt.config.ts (already has Zephyr integration)'
      );
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
      expect(output).toContain('✓ Added Zephyr integration to vite.config.js');
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

    it('should pin the Metro companion package in dry-run output', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          packageManager: 'pnpm@11.0.0',
          dependencies: { 'react-native': '^0.79.0' },
          devDependencies: {
            '@react-native-community/cli': '^19.0.0',
            'zephyr-metro-plugin': '^1.3.0',
            ...compatibleMetroPeers,
          },
        })
      );
      fs.writeFileSync(
        'metro.config.js',
        `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
      );

      const output = runCodemod('--dry-run');

      expect(output).toContain('@module-federation/metro@^2.9.0');
      expect(output).toContain('zephyr-metro-plugin@^1.4.0');
    });

    it('should count dependency installation failures in the summary', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          dependencies: { 'react-native': '^0.79.0' },
          devDependencies: {
            '@react-native-community/cli': '^19.0.0',
            ...compatibleMetroPeers,
            'zephyr-metro-plugin': '^1.4.0',
          },
        })
      );
      fs.writeFileSync(
        'metro.config.js',
        `const { withModuleFederation } = require("@module-federation/metro");\nconst { withZephyr } = require("zephyr-metro-plugin");\nmodule.exports = withZephyr()(withModuleFederation({}, { name: "app" }));\n`
      );
      const fakeBin = path.join(tempDir, 'fake-bin');
      fs.mkdirSync(fakeBin);
      const fakePnpm = path.join(fakeBin, 'pnpm');
      fs.writeFileSync(fakePnpm, '#!/bin/sh\nexit 1\n');
      fs.chmodSync(fakePnpm, 0o755);
      fs.writeFileSync(path.join(fakeBin, 'pnpm.cmd'), '@exit /b 1\r\n');

      const output = runCodemod('', true, {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        npm_config_user_agent: 'pnpm/11.0.0',
      });

      expect(output).toContain('Failed to install dependencies from package.json');
      expect(output).toContain('✗ Errors: 2');
      expect(output).not.toContain('Publish the first bundle with:');
    });

    it('should not advertise publication when declared companions remain unresolved', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          packageManager: 'pnpm@11.0.0',
          dependencies: { 'react-native': '^0.79.0' },
          devDependencies: {
            '@module-federation/metro': '^2.9.0',
            '@react-native-community/cli': '^19.0.0',
            ...compatibleMetroPeers,
            'zephyr-metro-plugin': '^1.4.0',
          },
        })
      );
      fs.writeFileSync(
        'metro.config.js',
        `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
      );
      const fakeBin = path.join(tempDir, 'fake-bin');
      fs.mkdirSync(fakeBin);
      const fakePnpm = path.join(fakeBin, 'pnpm');
      fs.writeFileSync(fakePnpm, '#!/bin/sh\nexit 0\n');
      fs.chmodSync(fakePnpm, 0o755);
      fs.writeFileSync(path.join(fakeBin, 'pnpm.cmd'), '@exit /b 0\r\n');

      const output = runCodemod('', true, {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        npm_config_user_agent: 'pnpm/11.0.0',
      });

      expect(output).toContain(
        'zephyr-metro-plugin, @module-federation/metro cannot be resolved at compatible versions'
      );
      expect(output).toContain('✗ Errors: 2');
      expect(output).not.toContain('Publish the first bundle with:');
    });

    it('should preserve a production Metro plugin requirement when merging', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          packageManager: 'pnpm@11.0.0',
          dependencies: {
            'react-native': '^0.79.0',
            'zephyr-metro-plugin': '^1.3.0',
          },
          devDependencies: {
            '@module-federation/metro': '^2.9.0',
            '@react-native-community/cli': '^19.0.0',
            ...compatibleMetroPeers,
          },
        })
      );
      fs.writeFileSync(
        'metro.config.js',
        `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
      );
      const fakeBin = path.join(tempDir, 'fake-bin');
      fs.mkdirSync(fakeBin);
      const fakeScript = path.join(fakeBin, 'fake-pnpm.js');
      fs.writeFileSync(
        fakeScript,
        `const fs = require("node:fs"); const path = require("node:path"); for (const [name, version] of [["zephyr-metro-plugin", "1.4.2"], ["@module-federation/metro", "2.9.1"]]) { const dir = path.join(process.cwd(), "node_modules", ...name.split("/")); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version })); }\n`
      );
      const fakePnpm = path.join(fakeBin, 'pnpm');
      fs.writeFileSync(fakePnpm, `#!/bin/sh\n"${process.execPath}" "${fakeScript}"\n`);
      fs.chmodSync(fakePnpm, 0o755);
      fs.writeFileSync(
        path.join(fakeBin, 'pnpm.cmd'),
        `@"${process.execPath}" "${fakeScript}"\r\n`
      );

      runCodemod('', false, {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        npm_config_user_agent: 'pnpm/11.0.0',
      });
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

      expect(packageJson.dependencies['zephyr-metro-plugin']).toBe('^1.4.0');
      expect(packageJson.devDependencies['zephyr-metro-plugin']).toBeUndefined();
    });

    it('should preserve managed Metro companion declarations during install', () => {
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          packageManager: 'pnpm@11.0.0',
          dependencies: { 'react-native': '^0.79.0' },
          devDependencies: {
            '@module-federation/metro': 'catalog:',
            '@react-native-community/cli': '^19.0.0',
            ...compatibleMetroPeers,
            'zephyr-metro-plugin': 'workspace:*',
          },
        })
      );
      fs.writeFileSync(
        'metro.config.js',
        `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
      );
      const fakeBin = path.join(tempDir, 'fake-bin');
      fs.mkdirSync(fakeBin);
      const fakeScript = path.join(fakeBin, 'fake-pnpm.js');
      fs.writeFileSync(
        fakeScript,
        `const fs = require("node:fs"); const path = require("node:path"); for (const [name, version] of [["zephyr-metro-plugin", "1.4.2"], ["@module-federation/metro", "2.9.1"]]) { const dir = path.join(process.cwd(), "node_modules", ...name.split("/")); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version })); }\n`
      );
      const fakePnpm = path.join(fakeBin, 'pnpm');
      fs.writeFileSync(fakePnpm, `#!/bin/sh\n"${process.execPath}" "${fakeScript}"\n`);
      fs.chmodSync(fakePnpm, 0o755);
      fs.writeFileSync(
        path.join(fakeBin, 'pnpm.cmd'),
        `@"${process.execPath}" "${fakeScript}"\r\n`
      );

      const output = runCodemod('', false, {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        npm_config_user_agent: 'pnpm/11.0.0',
      });
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

      expect(packageJson.devDependencies['zephyr-metro-plugin']).toBe('workspace:*');
      expect(packageJson.devDependencies['@module-federation/metro']).toBe('catalog:');
      expect(output).toContain('Publish the first bundle with:');
    });

    it('should fail when a successful nested install leaves requirements unresolved', () => {
      fs.writeFileSync('package.json', JSON.stringify({ private: true }));
      const projectDirectory = path.join(tempDir, 'apps', 'standalone');
      fs.mkdirSync(projectDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(projectDirectory, 'package.json'),
        JSON.stringify({
          packageManager: 'pnpm@11.0.0',
          dependencies: { 'react-native': '^0.79.0' },
          devDependencies: {
            '@react-native-community/cli': '^19.0.0',
            ...compatibleMetroPeers,
          },
        })
      );
      fs.writeFileSync(
        path.join(projectDirectory, 'metro.config.js'),
        `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
      );
      const fakeBin = path.join(tempDir, 'fake-bin');
      fs.mkdirSync(fakeBin);
      const fakeScript = path.join(fakeBin, 'fake-pnpm.js');
      fs.writeFileSync(fakeScript, 'process.exit(0);\n');
      const fakePnpm = path.join(fakeBin, 'pnpm');
      fs.writeFileSync(fakePnpm, `#!/bin/sh\n"${process.execPath}" "${fakeScript}"\n`);
      fs.chmodSync(fakePnpm, 0o755);
      fs.writeFileSync(
        path.join(fakeBin, 'pnpm.cmd'),
        `@"${process.execPath}" "${fakeScript}"\r\n`
      );

      const output = runCodemod('', true, {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        npm_config_user_agent: 'pnpm/11.0.0',
      });

      expect(output).toContain(
        'Installed dependencies in apps/standalone, but zephyr-metro-plugin, @module-federation/metro still cannot be resolved at compatible versions'
      );
      expect(output).toContain('✗ Errors: 2');
      expect(output).not.toContain('Publish the first bundle with:');
    });

    it('should not reinstall a nested project covered by the root workspace', () => {
      fs.writeFileSync('package.json', JSON.stringify({ private: true }));
      for (const [packageName, version] of [
        ['zephyr-metro-plugin', '1.4.2'],
        ['@module-federation/metro', '2.9.1'],
      ]) {
        const packageDirectory = path.join(
          tempDir,
          'node_modules',
          ...packageName.split('/')
        );
        fs.mkdirSync(packageDirectory, { recursive: true });
        fs.writeFileSync(
          path.join(packageDirectory, 'package.json'),
          JSON.stringify({ name: packageName, version })
        );
      }
      const projectDirectory = path.join(tempDir, 'apps', 'workspace-native');
      fs.mkdirSync(projectDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(projectDirectory, 'package.json'),
        JSON.stringify({
          dependencies: { 'react-native': '^0.79.0' },
          devDependencies: {
            '@react-native-community/cli': '^19.0.0',
            ...compatibleMetroPeers,
          },
        })
      );
      fs.writeFileSync(
        path.join(projectDirectory, 'metro.config.js'),
        `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
      );
      const fakeBin = path.join(tempDir, 'fake-bin');
      fs.mkdirSync(fakeBin);
      const installsFile = path.join(tempDir, 'installs.txt');
      const fakeScript = path.join(fakeBin, 'fake-pnpm.js');
      fs.writeFileSync(
        fakeScript,
        `require("node:fs").appendFileSync(${JSON.stringify(installsFile)}, process.cwd() + "\\n");\n`
      );
      const fakePnpm = path.join(fakeBin, 'pnpm');
      fs.writeFileSync(fakePnpm, `#!/bin/sh\n"${process.execPath}" "${fakeScript}"\n`);
      fs.chmodSync(fakePnpm, 0o755);
      fs.writeFileSync(
        path.join(fakeBin, 'pnpm.cmd'),
        `@"${process.execPath}" "${fakeScript}"\r\n`
      );

      runCodemod('', false, {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        npm_config_user_agent: 'pnpm/11.0.0',
      });

      const installDirectories = fs
        .readFileSync(installsFile, 'utf8')
        .trim()
        .split(/\r?\n/);
      expect(installDirectories).toHaveLength(1);
      expect(path.basename(installDirectories[0]!)).toBe(path.basename(tempDir));
    });

    it('should print Android for Android-only CLI projects', () => {
      writeResolvedMetroCompanions();
      fs.writeFileSync(
        'package.json',
        JSON.stringify({
          dependencies: { 'react-native': '^0.79.0' },
          devDependencies: {
            '@module-federation/metro': '^2.9.0',
            '@react-native-community/cli': '^19.0.0',
            '@react-native-community/cli-platform-android': '^19.0.0',
            ...compatibleMetroPeers,
            'zephyr-metro-plugin': '^1.4.0',
          },
        })
      );
      fs.writeFileSync(
        'metro.config.js',
        `const { withModuleFederation } = require("@module-federation/metro");\nmodule.exports = withModuleFederation({}, { name: "app" });\n`
      );

      const output = runCodemod();

      expect(output).toContain(
        'npx react-native bundle-mf-remote --platform android --dev false'
      );
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
        '🚀 Zephyr Codemod - Adding Zephyr integration to configs'
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
      expect(output).toContain('✓ Added Zephyr integration to vite.config.js');
    });
  });
});
