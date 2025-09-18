import { describe, expect, it } from '@rstest/core';
import { BUNDLER_CONFIGS } from '../bundler-configs.js';

describe('Bundler Configurations', () => {
  describe('Configuration Structure', () => {
    it('should have all required bundler configurations', () => {
      const expectedBundlers = [
        'webpack',
        'rspack',
        'vite',
        'rollup',
        'rolldown',
        'modernjs',
        'rspress',
        'parcel',
        'repack',
        'rsbuild',
        'rslib',
      ];

      expectedBundlers.forEach((bundler) => {
        expect(BUNDLER_CONFIGS).toHaveProperty(bundler);
      });
    });

    it('should have valid configuration structure for each bundler', () => {
      Object.entries(BUNDLER_CONFIGS).forEach(([, config]) => {
        expect(config).toHaveProperty('files');
        expect(config).toHaveProperty('plugin');
        expect(config).toHaveProperty('importName');
        expect(config).toHaveProperty('patterns');

        expect(Array.isArray(config.files)).toBe(true);
        expect(config.files.length).toBeGreaterThan(0);
        expect(typeof config.plugin).toBe('string');
        expect(config.plugin).toBeTruthy();
        expect(Array.isArray(config.patterns)).toBe(true);
        expect(config.patterns.length).toBeGreaterThan(0);

        // importName can be string or null (for Parcel)
        if (config.importName !== null) {
          expect(typeof config.importName).toBe('string');
        }
      });
    });

    it('should have valid pattern structure', () => {
      Object.values(BUNDLER_CONFIGS).forEach((config) => {
        config.patterns.forEach((pattern) => {
          expect(pattern).toHaveProperty('type');
          expect(pattern).toHaveProperty('matcher');
          expect(pattern).toHaveProperty('transform');

          expect(typeof pattern.type).toBe('string');
          expect(pattern.matcher instanceof RegExp).toBe(true);
          expect(typeof pattern.transform).toBe('string');
        });
      });
    });
  });

  describe('Webpack Configuration', () => {
    const webpackConfig = BUNDLER_CONFIGS.webpack;

    it('should support correct file extensions', () => {
      expect(webpackConfig.files).toEqual([
        'webpack.config.js',
        'webpack.config.ts',
        'webpack.config.mjs',
      ]);
    });

    it('should use correct plugin package', () => {
      expect(webpackConfig.plugin).toBe('zephyr-webpack-plugin');
      expect(webpackConfig.importName).toBe('withZephyr');
    });

    it('should have composePlugins pattern', () => {
      const composePattern = webpackConfig.patterns.find(
        (p) => p.type === 'compose-plugins'
      );
      expect(composePattern).toBeDefined();
      expect(composePattern?.matcher.test('composePlugins(')).toBe(true);
    });
  });

  describe('Rspack Configuration', () => {
    const rspackConfig = BUNDLER_CONFIGS.rspack;

    it('should support correct file extensions', () => {
      expect(rspackConfig.files).toEqual([
        'rspack.config.js',
        'rspack.config.ts',
        'rspack.config.mjs',
      ]);
    });

    it('should use correct plugin package', () => {
      expect(rspackConfig.plugin).toBe('zephyr-rspack-plugin');
      expect(rspackConfig.importName).toBe('withZephyr');
    });

    it('should handle wrapped export pattern', () => {
      const wrappedPattern = rspackConfig.patterns.find(
        (p) => p.type === 'export-wrapped-call'
      );
      expect(wrappedPattern).toBeDefined();
      expect(wrappedPattern?.matcher.test('export default withZephyr()(')).toBe(true);
    });
  });

  describe('Vite Configuration', () => {
    const viteConfig = BUNDLER_CONFIGS.vite;

    it('should support correct file extensions including .mts', () => {
      expect(viteConfig.files).toEqual([
        'vite.config.js',
        'vite.config.ts',
        'vite.config.mjs',
        'vite.config.mts',
      ]);
    });

    it('should use correct plugin package', () => {
      expect(viteConfig.plugin).toBe('vite-plugin-zephyr');
      expect(viteConfig.importName).toBe('withZephyr');
    });

    it('should handle function wrapper pattern', () => {
      const functionPattern = viteConfig.patterns.find(
        (p) => p.type === 'define-config-function'
      );
      expect(functionPattern).toBeDefined();
      expect(functionPattern?.matcher.test('defineConfig(() => ({')).toBe(true);
    });
  });

  describe('Rollup Configuration', () => {
    const rollupConfig = BUNDLER_CONFIGS.rollup;

    it('should use correct plugin package', () => {
      expect(rollupConfig.plugin).toBe('rollup-plugin-zephyr');
      expect(rollupConfig.importName).toBe('withZephyr');
    });

    it('should handle array export pattern', () => {
      const arrayPattern = rollupConfig.patterns.find((p) => p.type === 'export-array');
      expect(arrayPattern).toBeDefined();
      expect(arrayPattern?.matcher.test('export default [')).toBe(true);
    });
  });

  describe('Modern.js Configuration', () => {
    const modernjsConfig = BUNDLER_CONFIGS.modernjs;

    it('should support correct file extensions', () => {
      expect(modernjsConfig.files).toEqual([
        'modern.config.js',
        'modern.config.ts',
        'modern.config.mjs',
      ]);
    });

    it('should use correct plugin package', () => {
      expect(modernjsConfig.plugin).toBe('zephyr-modernjs-plugin');
      expect(modernjsConfig.importName).toBe('withZephyr');
    });
  });

  describe('RSPress Configuration', () => {
    const rspressConfig = BUNDLER_CONFIGS.rspress;

    it('should support correct file extensions', () => {
      expect(rspressConfig.files).toEqual([
        'rspress.config.js',
        'rspress.config.ts',
        'rspress.config.mjs',
      ]);
    });

    it('should use correct plugin package', () => {
      expect(rspressConfig.plugin).toBe('zephyr-rspress-plugin');
      expect(rspressConfig.importName).toBe('withZephyr');
    });
  });

  describe('Parcel Configuration', () => {
    const parcelConfig = BUNDLER_CONFIGS.parcel;

    it('should support JSON configuration files', () => {
      expect(parcelConfig.files).toEqual(['.parcelrc', '.parcelrc.json']);
    });

    it('should use reporter pattern', () => {
      expect(parcelConfig.plugin).toBe('parcel-reporter-zephyr');
      expect(parcelConfig.importName).toBe(null); // Parcel uses JSON config
    });

    it('should have reporters pattern', () => {
      const reportersPattern = parcelConfig.patterns.find(
        (p) => p.type === 'parcel-reporters'
      );
      expect(reportersPattern).toBeDefined();
      expect(reportersPattern?.matcher.test('"reporters": [')).toBe(true);
    });
  });

  describe('Re.Pack Configuration', () => {
    const repackConfig = BUNDLER_CONFIGS.repack;

    it('should use rspack config files', () => {
      expect(repackConfig.files).toEqual([
        'rspack.config.js',
        'rspack.config.ts',
        'rspack.config.mjs',
      ]);
    });

    it('should use correct plugin package', () => {
      expect(repackConfig.plugin).toBe('zephyr-repack-plugin');
      expect(repackConfig.importName).toBe('withZephyr');
    });

    it('should handle conditional withZephyr pattern', () => {
      const conditionalPattern = repackConfig.patterns.find(
        (p) => p.type === 'export-conditional-withzephyr'
      );
      expect(conditionalPattern).toBeDefined();
      expect(
        conditionalPattern?.matcher.test('export default USE_ZEPHYR ? withZephyr()(')
      ).toBe(true);
    });

    it('should handle function export pattern', () => {
      const functionPattern = repackConfig.patterns.find(
        (p) => p.type === 'export-function-variable'
      );
      expect(functionPattern).toBeDefined();
      expect(functionPattern?.matcher.test('export default config;')).toBe(true);
    });
  });

  describe('RSBuild Configuration', () => {
    const rsbuildConfig = BUNDLER_CONFIGS.rsbuild;

    it('should support correct file extensions', () => {
      expect(rsbuildConfig.files).toEqual([
        'rsbuild.config.js',
        'rsbuild.config.ts',
        'rsbuild.config.mjs',
      ]);
    });

    it('should use rsbuild plugin', () => {
      expect(rsbuildConfig.plugin).toBe('zephyr-rsbuild-plugin');
      expect(rsbuildConfig.importName).toBe('withZephyr');
    });

    it('should detect existing zephyr plugin', () => {
      const existingPattern = rsbuildConfig.patterns.find(
        (p) => p.type === 'zephyr-rsbuild-plugin-exists'
      );
      expect(existingPattern).toBeDefined();
      expect(existingPattern?.matcher.test('zephyrRSbuildPlugin')).toBe(true);
    });

    it('should handle defineConfig pattern', () => {
      const definePattern = rsbuildConfig.patterns.find(
        (p) => p.type === 'define-config'
      );
      expect(definePattern).toBeDefined();
      expect(definePattern?.matcher.test('defineConfig({')).toBe(true);
    });
  });

  describe('RSLib Configuration', () => {
    const rslibConfig = BUNDLER_CONFIGS.rslib;

    it('should support correct file extensions', () => {
      expect(rslibConfig.files).toEqual([
        'rslib.config.js',
        'rslib.config.ts',
        'rslib.config.mjs',
      ]);
    });

    it('should use rsbuild plugin', () => {
      expect(rslibConfig.plugin).toBe('zephyr-rsbuild-plugin');
      expect(rslibConfig.importName).toBe('withZephyr');
    });

    it('should detect existing zephyr plugin', () => {
      const existingPattern = rslibConfig.patterns.find(
        (p) => p.type === 'zephyr-rsbuild-plugin-exists'
      );
      expect(existingPattern).toBeDefined();
      expect(existingPattern?.matcher.test('zephyrRSbuildPlugin')).toBe(true);
    });

    it('should handle defineConfig pattern', () => {
      const definePattern = rslibConfig.patterns.find((p) => p.type === 'define-config');
      expect(definePattern).toBeDefined();
      expect(definePattern?.matcher.test('defineConfig({')).toBe(true);
    });
  });

  describe('Pattern Matching', () => {
    it('should correctly match webpack composePlugins pattern', () => {
      const pattern = BUNDLER_CONFIGS.webpack.patterns.find(
        (p) => p.type === 'compose-plugins'
      );
      expect(pattern?.matcher.test('composePlugins(')).toBe(true);
      expect(pattern?.matcher.test('composePlugins   (')).toBe(true);
      expect(pattern?.matcher.test('notComposePlugins(')).toBe(false);
    });

    it('should correctly match vite defineConfig patterns', () => {
      const definePattern = BUNDLER_CONFIGS.vite.patterns.find(
        (p) => p.type === 'define-config'
      );
      const functionPattern = BUNDLER_CONFIGS.vite.patterns.find(
        (p) => p.type === 'define-config-function'
      );

      expect(definePattern?.matcher.test('defineConfig({')).toBe(true);
      expect(definePattern?.matcher.test('defineConfig  ({')).toBe(true);

      expect(functionPattern?.matcher.test('defineConfig(() => ({')).toBe(true);
      expect(functionPattern?.matcher.test('defineConfig( () => ({')).toBe(true);
    });

    it('should correctly match plugins array pattern', () => {
      const webpackPluginsPattern = BUNDLER_CONFIGS.webpack.patterns.find(
        (p) => p.type === 'plugins-array'
      );

      expect(webpackPluginsPattern?.matcher.test('plugins: [')).toBe(true);
      expect(webpackPluginsPattern?.matcher.test('plugins  :  [')).toBe(true);
      expect(webpackPluginsPattern?.matcher.test('notPlugins: [')).toBe(false);
    });

    it('should correctly match rollup array export pattern', () => {
      const arrayPattern = BUNDLER_CONFIGS.rollup.patterns.find(
        (p) => p.type === 'export-array'
      );

      expect(arrayPattern?.matcher.test('export default [')).toBe(true);
      expect(arrayPattern?.matcher.test('export  default  [')).toBe(true);
      expect(arrayPattern?.matcher.test('export const config = [')).toBe(false);
    });
  });
});
