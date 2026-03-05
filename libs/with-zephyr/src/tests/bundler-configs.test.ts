import { describe, expect, it } from '@rstest/core';
import {
  BUNDLER_CONFIGS,
  webpackConfig,
  rspackConfig,
  viteConfig,
  rollupConfig,
  rolldownConfig,
  rsbuildConfig,
  rslibConfig,
  parcelConfig,
  astroConfig,
  modernjsConfig,
  rspressConfig,
  metroConfig,
  repackConfig,
} from '../bundlers/index.js';

describe('Bundler Configurations', () => {
  describe('Configuration Structure', () => {
    it('should have all required bundler configurations', () => {
      const expectedBundlers = [
        'webpack',
        'rspack',
        'vite',
        'rollup',
        'rolldown',
        'astro',
        'modernjs',
        'rspress',
        'parcel',
        'metro',
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
        expect(config).toHaveProperty('strategy');
        expect(config).toHaveProperty('operations');

        expect(Array.isArray(config.files)).toBe(true);
        expect(config.files.length).toBeGreaterThan(0);
        expect(typeof config.plugin).toBe('string');
        expect(config.plugin).toBeTruthy();
        expect(Array.isArray(config.operations)).toBe(true);
        expect(config.operations.length).toBeGreaterThan(0);
        expect(['first-success', 'run-all']).toContain(config.strategy);

        if (config.importName !== null) {
          expect(typeof config.importName).toBe('string');
        }
      });
    });

    it('should support direct imports of individual bundler configs', () => {
      expect(webpackConfig).toBe(BUNDLER_CONFIGS.webpack);
      expect(viteConfig).toBe(BUNDLER_CONFIGS.vite);
      expect(rspackConfig).toBe(BUNDLER_CONFIGS.rspack);
      expect(rollupConfig).toBe(BUNDLER_CONFIGS.rollup);
      expect(rolldownConfig).toBe(BUNDLER_CONFIGS.rolldown);
      expect(rsbuildConfig).toBe(BUNDLER_CONFIGS.rsbuild);
      expect(rslibConfig).toBe(BUNDLER_CONFIGS.rslib);
      expect(parcelConfig).toBe(BUNDLER_CONFIGS.parcel);
      expect(astroConfig).toBe(BUNDLER_CONFIGS.astro);
      expect(modernjsConfig).toBe(BUNDLER_CONFIGS.modernjs);
      expect(rspressConfig).toBe(BUNDLER_CONFIGS.rspress);
      expect(metroConfig).toBe(BUNDLER_CONFIGS.metro);
      expect(repackConfig).toBe(BUNDLER_CONFIGS.repack);
    });
  });

  describe('Bundler Specific Defaults', () => {
    it('should keep expected package names', () => {
      expect(webpackConfig.plugin).toBe('zephyr-webpack-plugin');
      expect(rspackConfig.plugin).toBe('zephyr-rspack-plugin');
      expect(viteConfig.plugin).toBe('vite-plugin-zephyr');
      expect(rollupConfig.plugin).toBe('rollup-plugin-zephyr');
      expect(rolldownConfig.plugin).toBe('zephyr-rolldown-plugin');
      expect(rsbuildConfig.plugin).toBe('zephyr-rsbuild-plugin');
      expect(rslibConfig.plugin).toBe('zephyr-rsbuild-plugin');
      expect(parcelConfig.plugin).toBe('parcel-reporter-zephyr');
      expect(astroConfig.plugin).toBe('zephyr-astro-integration');
      expect(modernjsConfig.plugin).toBe('zephyr-modernjs-plugin');
      expect(rspressConfig.plugin).toBe('zephyr-rspress-plugin');
      expect(metroConfig.plugin).toBe('zephyr-metro-plugin');
      expect(repackConfig.plugin).toBe('zephyr-repack-plugin');
    });

    it('should use run-all strategy for rsbuild and parcel', () => {
      expect(rsbuildConfig.strategy).toBe('run-all');
      expect(parcelConfig.strategy).toBe('run-all');
    });

    it('should include rsbuild assetPrefix operation', () => {
      expect(rsbuildConfig.operations).toContain('rsbuild-asset-prefix');
      expect(rsbuildConfig.operations).toContain('plugins-array-or-create');
    });

    it('should prioritize rspack defineConfig wrapping before plugins array fallback', () => {
      expect(rspackConfig.operations[0]).toBe('wrap-export-default-define-config');
      expect(rspackConfig.operations).toContain('plugins-array');
      expect(rspackConfig.operations).toContain('wrap-module-exports');
    });

    it('should use parcel reporter helper operation', () => {
      expect(parcelConfig.operations).toEqual(['parcel-reporters']);
      expect(parcelConfig.importName).toBeNull();
    });

    it('should use repack exported-function wrapping operation', () => {
      expect(repackConfig.operations).toEqual(['wrap-exported-function']);
      expect(repackConfig.files).toEqual([
        'rspack.config.js',
        'rspack.config.ts',
        'rspack.config.mjs',
      ]);
    });

    it('should use async module.exports wrapping operation for metro', () => {
      expect(metroConfig.operations).toEqual([
        'wrap-module-exports-async',
        'wrap-export-default-async',
      ]);
      expect(metroConfig.files).toEqual([
        'metro.config.js',
        'metro.config.ts',
        'metro.config.mjs',
        'metro.config.cjs',
      ]);
    });
  });
});
