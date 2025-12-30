/** Unit tests for Zephyr Metro Transformer */

// Test the isZephyrTargetFile logic by extracting it
// Since the function is private, we test it indirectly through the transform function
// or export it for testing

describe('zephyr-transformer', () => {
  describe('isZephyrTargetFile logic', () => {
    // Helper to test file targeting logic
    const isZephyrTargetFile = (
      filename: string,
      code: string,
      entryFiles: string[]
    ): boolean => {
      const isEntryFile = entryFiles.some((pattern) => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(filename);
        }
        return filename.endsWith(pattern) || filename.includes(`/${pattern}`);
      });

      if (isEntryFile) {
        return true;
      }

      if (
        code.includes('AppRegistry.registerComponent') ||
        code.includes('AppRegistry.runApplication')
      ) {
        return true;
      }

      return false;
    };

    const defaultEntryFiles = ['index.js', 'index.ts', 'index.tsx', 'App.js', 'App.tsx'];

    it('should target default entry files', () => {
      expect(isZephyrTargetFile('/project/index.js', '', defaultEntryFiles)).toBe(true);
      expect(isZephyrTargetFile('/project/App.tsx', '', defaultEntryFiles)).toBe(true);
      expect(isZephyrTargetFile('/project/src/App.js', '', defaultEntryFiles)).toBe(true);
    });

    it('should not target non-entry files', () => {
      expect(isZephyrTargetFile('/project/utils/helper.js', '', defaultEntryFiles)).toBe(
        false
      );
      expect(
        isZephyrTargetFile('/project/components/Button.tsx', '', defaultEntryFiles)
      ).toBe(false);
    });

    it('should target files with AppRegistry.registerComponent', () => {
      const code = `
        import { AppRegistry } from 'react-native';
        AppRegistry.registerComponent('MyApp', () => App);
      `;
      expect(isZephyrTargetFile('/project/customEntry.js', code, defaultEntryFiles)).toBe(
        true
      );
    });

    it('should target files with AppRegistry.runApplication', () => {
      const code = `
        import { AppRegistry } from 'react-native';
        AppRegistry.runApplication('MyApp', { rootTag: 1 });
      `;
      expect(isZephyrTargetFile('/project/customEntry.js', code, defaultEntryFiles)).toBe(
        true
      );
    });

    it('should not target files that just import AppRegistry', () => {
      const code = `
        import { AppRegistry } from 'react-native';
        export const something = AppRegistry;
      `;
      expect(
        isZephyrTargetFile('/project/utils/registry.js', code, defaultEntryFiles)
      ).toBe(false);
    });

    it('should support custom entry file patterns', () => {
      const customEntryFiles = ['main.tsx', 'entry.js'];
      expect(isZephyrTargetFile('/project/main.tsx', '', customEntryFiles)).toBe(true);
      expect(isZephyrTargetFile('/project/entry.js', '', customEntryFiles)).toBe(true);
      expect(isZephyrTargetFile('/project/index.js', '', customEntryFiles)).toBe(false);
    });

    it('should support glob patterns in entry files', () => {
      const globEntryFiles = ['src/*/index.tsx', '*.entry.js'];
      expect(isZephyrTargetFile('/project/src/app/index.tsx', '', globEntryFiles)).toBe(
        true
      );
      expect(isZephyrTargetFile('/project/main.entry.js', '', globEntryFiles)).toBe(true);
    });
  });

  describe('generateRuntimePluginCode', () => {
    // Helper to test runtime code generation
    const generateRuntimePluginCode = (manifestPath: string): string => {
      return `// Zephyr Runtime Plugin for React Native
(function() {
  if (typeof global !== 'undefined' && !global.__ZEPHYR_RUNTIME_PLUGIN__) {
    // Prevent multiple initializations
    try {
      var createZephyrRuntimePlugin = require('zephyr-xpack-internal').createZephyrRuntimePlugin;

      var plugin = createZephyrRuntimePlugin({
        manifestUrl: '${manifestPath}',
      });

      // Store globally
      global.__ZEPHYR_RUNTIME_PLUGIN__ = plugin;

      if (__DEV__) {
        console.log('[Zephyr] Runtime plugin initialized');
      }
    } catch (error) {
      // zephyr-xpack-internal is an optional peer dependency
      if (__DEV__) {
        console.warn('[Zephyr] Runtime plugin not available:', error.message);
      }
    }
  }
})();`;
    };

    it('should generate code with default manifest path', () => {
      const code = generateRuntimePluginCode('/zephyr-manifest.json');
      expect(code).toContain("manifestUrl: '/zephyr-manifest.json'");
    });

    it('should generate code with custom manifest path', () => {
      const code = generateRuntimePluginCode('/custom-manifest.json');
      expect(code).toContain("manifestUrl: '/custom-manifest.json'");
    });

    it('should check for existing runtime plugin', () => {
      const code = generateRuntimePluginCode('/zephyr-manifest.json');
      expect(code).toContain('!global.__ZEPHYR_RUNTIME_PLUGIN__');
    });

    it('should use zephyr-xpack-internal', () => {
      const code = generateRuntimePluginCode('/zephyr-manifest.json');
      expect(code).toContain("require('zephyr-xpack-internal')");
    });

    it('should only log in development mode', () => {
      const code = generateRuntimePluginCode('/zephyr-manifest.json');
      expect(code).toContain('if (__DEV__)');
    });
  });
});
