/* eslint-disable @typescript-eslint/no-floating-promises */
import generate from '@babel/generator';
import { parse } from '@babel/parser';
import { beforeEach, describe, expect, it } from '@rstest/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  addToComposePlugins,
  addToPluginsArray,
  addToPluginsArrayOrCreate,
  addToRollupArrayConfig,
  addToVitePlugins,
  addToVitePluginsInFunction,
  hasZephyrPlugin,
  parseFile,
  wrapExportDefault,
  wrapExportedFunction,
  writeFile,
} from '../transformers/index.js';

describe('Zephyr Codemod Transformers', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zephyr-test-'));
  });

  describe('hasZephyrPlugin', () => {
    it('should detect withZephyr call expression', () => {
      const code = `
        import { withZephyr } from 'vite-plugin-zephyr';
        export default withZephyr()({
          plugins: []
        });
      `;
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript'],
      });
      expect(hasZephyrPlugin(ast)).toBe(true);
    });

    it('should return false when withZephyr is not present', () => {
      const code = `
        export default {
          plugins: []
        };
      `;
      const ast = parse(code, { sourceType: 'module' });
      expect(hasZephyrPlugin(ast)).toBe(false);
    });
  });

  describe('addToComposePlugins', () => {
    it('should add withZephyr to composePlugins call', () => {
      const code = `
        import { composePlugins, withNx } from '@nx/webpack';
        import { withReact } from '@nx/react';

        export default composePlugins(
          withNx(),
          withReact(),
          (config) => config
        );
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript'],
      });
      addToComposePlugins(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(
        /composePlugins\s*\(\s*withNx\(\),\s*withReact\(\),\s*withZephyr\(\)/
      );
    });
  });

  describe('addToPluginsArray', () => {
    it('should add withZephyr to plugins array', () => {
      const code = `
        export default {
          plugins: [
            somePlugin(),
            anotherPlugin()
          ]
        };
      `;

      const ast = parse(code, { sourceType: 'module' });
      addToPluginsArray(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(
        /plugins:\s*\[\s*somePlugin\(\),\s*anotherPlugin\(\),\s*withZephyr\(\)\s*\]/
      );
    });
  });

  describe('addToPluginsArrayOrCreate', () => {
    it('should add withZephyr to existing plugins array in defineConfig', () => {
      const code = `
        import { defineConfig } from 'rspress/config';

        export default defineConfig({
          root: './docs',
          plugins: [existingPlugin()]
        });
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript'],
      });
      addToPluginsArrayOrCreate(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(/plugins:\s*\[\s*existingPlugin\(\),\s*withZephyr\(\)\s*\]/);
    });

    it('should create plugins array when it does not exist in defineConfig', () => {
      const code = `
        import { defineConfig } from 'rspress/config';

        export default defineConfig({
          root: './docs',
          title: 'My Site',
          themeConfig: {
            socialLinks: []
          }
        });
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript'],
      });
      addToPluginsArrayOrCreate(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(/plugins:\s*\[\s*withZephyr\(\)\s*\]/);
    });

    it('should fallback to addToPluginsArray when no defineConfig found', () => {
      const code = `
        export default {
          plugins: [somePlugin()]
        };
      `;

      const ast = parse(code, { sourceType: 'module' });
      addToPluginsArrayOrCreate(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(/plugins:\s*\[\s*somePlugin\(\),\s*withZephyr\(\)\s*\]/);
    });
  });

  describe('addToVitePlugins', () => {
    it('should add withZephyr to Vite defineConfig', () => {
      const code = `
        import { defineConfig } from 'vite';

        export default defineConfig({
          plugins: [react()]
        });
      `;

      const ast = parse(code, { sourceType: 'module' });
      addToVitePlugins(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(/plugins:\s*\[\s*react\(\),\s*withZephyr\(\)\s*\]/);
    });
  });

  describe('addToVitePluginsInFunction', () => {
    it('should add withZephyr to Vite config with function wrapper', () => {
      const code = `
        import { defineConfig } from 'vite';

        export default defineConfig(() => ({
          plugins: [angular()]
        }));
      `;

      const ast = parse(code, { sourceType: 'module' });
      addToVitePluginsInFunction(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(/plugins:\s*\[\s*angular\(\),\s*withZephyr\(\)\s*\]/);
    });
  });

  describe('addToRollupArrayConfig', () => {
    it('should add withZephyr to Rollup array config', () => {
      const code = `
        export default [{
          input: 'src/index.ts',
          plugins: [
            resolve(),
            babel()
          ]
        }];
      `;

      const ast = parse(code, { sourceType: 'module' });
      addToRollupArrayConfig(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(
        /plugins:\s*\[\s*resolve\(\),\s*babel\(\),\s*withZephyr\(\)\s*\]/
      );
    });
  });

  describe('wrapExportDefault', () => {
    it('should wrap export default object with withZephyr', () => {
      const code = `
        export default {
          mode: 'development',
          entry: './src/index.js'
        };
      `;

      const ast = parse(code, { sourceType: 'module' });
      wrapExportDefault(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(/export default withZephyr\(\)\(\{[\s\S]*\}\);/);
    });
  });

  describe('wrapExportedFunction', () => {
    it('should wrap exported function with withZephyr for Re.Pack', () => {
      const code = `
        const config = env => {
          const {mode, platform} = env;
          return {
            mode,
            entry: './index.js'
          };
        };

        export default config;
      `;

      const ast = parse(code, { sourceType: 'module' });
      wrapExportedFunction(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(/export default withZephyr\(\)\(config\);/);
    });

    it('should skip conditional exports that already have withZephyr', () => {
      const code = `
        const config = env => ({ mode: 'development' });
        export default USE_ZEPHYR ? withZephyr()(config) : config;
      `;

      const ast = parse(code, { sourceType: 'module' });
      wrapExportedFunction(ast);
      const result = generate(ast).code;

      // Should not modify the conditional expression
      expect(result).toContain('USE_ZEPHYR ? withZephyr()(config) : config');
      expect(result.split('withZephyr').length).toBe(2); // Only one occurrence
    });
  });

  describe('addToPluginsArray (RSBuild)', () => {
    it('should add withZephyr to RSBuild plugins array', () => {
      const code = `
        import { defineConfig } from '@rsbuild/core';
        import { pluginReact } from '@rsbuild/plugin-react';

        export default defineConfig({
          plugins: [pluginReact()]
        });
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript'],
      });
      addToPluginsArray(ast);
      const result = generate(ast).code;

      expect(result).toContain('withZephyr()');
      expect(result).toMatch(/plugins:\s*\[\s*pluginReact\(\),\s*withZephyr\(\)\s*\]/);
    });
  });

  describe('Integration Tests', () => {
    it('should handle webpack config with composePlugins', () => {
      const configPath = path.join(tempDir, 'webpack.config.ts');
      const code = `
        import { composePlugins, withNx } from '@nx/webpack';
        import { withReact } from '@nx/react';
        import { withModuleFederation } from '@nx/react/module-federation';

        export default composePlugins(
          withNx(),
          withReact(),
          withModuleFederation(config),
          (config) => config
        );
      `;

      fs.writeFileSync(configPath, code);
      const ast = parseFile(configPath);
      addToComposePlugins(ast);
      writeFile(configPath, ast);

      const result = fs.readFileSync(configPath, 'utf8');
      expect(result).toContain('withZephyr()');
      expect(result).toMatch(/withModuleFederation\(config\),\s*withZephyr\(\),/);
    });

    it('should handle Vite config with complex setup', () => {
      const configPath = path.join(tempDir, 'vite.config.ts');
      const code = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import { resolve } from 'path';

        export default defineConfig({
          plugins: [react()],
          resolve: {
            alias: {
              '@': resolve(__dirname, 'src')
            }
          },
          server: {
            port: 3000
          }
        });
      `;

      fs.writeFileSync(configPath, code);
      const ast = parseFile(configPath);
      addToVitePlugins(ast);
      writeFile(configPath, ast);

      const result = fs.readFileSync(configPath, 'utf8');
      expect(result).toContain('withZephyr()');
      expect(result).toContain('react(), withZephyr()');
    });

    it('should handle RSBuild config transformation end-to-end', () => {
      const configPath = path.join(tempDir, 'rsbuild.config.ts');
      const code = `
        import { defineConfig } from '@rsbuild/core';
        import { pluginReact } from '@rsbuild/plugin-react';
        import { pluginSass } from '@rsbuild/plugin-sass';

        export default defineConfig({
          plugins: [pluginReact(), pluginSass()],
          html: {
            template: './public/index.html'
          }
        });
      `;

      fs.writeFileSync(configPath, code);
      const ast = parseFile(configPath);
      addToPluginsArray(ast);
      writeFile(configPath, ast);

      const result = fs.readFileSync(configPath, 'utf8');
      expect(result).toContain('withZephyr()');
      expect(result).toMatch(
        /plugins:\s*\[\s*pluginReact\(\),\s*pluginSass\(\),\s*withZephyr\(\)\s*\]/
      );
    });
  });
});
