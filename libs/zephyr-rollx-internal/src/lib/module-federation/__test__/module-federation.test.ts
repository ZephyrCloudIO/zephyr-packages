import { extract_remotes_dependencies } from '../extract-remotes';
import { generateRuntimePlugin } from '../runtime-plugin';
import { parseRuntimePlugin, injectRuntimePlugin } from '../runtime-plugins-parser';
import { load_resolved_remotes } from '../load-resolved-remotes';
import { extract_mf_plugin, extractMFConfig } from '../extract-mf-plugin';
import type { XFederatedConfig } from '../../types';

describe('Module Federation Shared Functionality', () => {
  describe('extract_remotes_dependencies', () => {
    it('should extract remotes from object format', () => {
      const mfConfig: XFederatedConfig = {
        name: 'host',
        remotes: {
          'mfe1': 'http://localhost:3001/remoteEntry.js',
          'mfe2': 'http://localhost:3002/remoteEntry.js'
        }
      };

      const result = extract_remotes_dependencies(mfConfig);
      
      expect(result).toEqual([
        { name: 'mfe1', version: 'latest' },
        { name: 'mfe2', version: 'latest' }
      ]);
    });

    it('should extract remotes from array format', () => {
      const mfConfig: XFederatedConfig = {
        name: 'host',
        remotes: [
          'mfe1@http://localhost:3001/remoteEntry.js',
          'mfe2@http://localhost:3002/remoteEntry.js'
        ]
      };

      const result = extract_remotes_dependencies(mfConfig);
      
      expect(result).toEqual([
        { name: 'mfe1', version: 'latest' },
        { name: 'mfe2', version: 'latest' }
      ]);
    });

    it('should fallback to zephyr dependencies', () => {
      const mfConfig: XFederatedConfig = {
        name: 'host'
      };

      const packageDeps = {
        'zephyr-mfe1': '1.0.0',
        'zephyr-mfe2': '2.0.0',
        'react': '18.0.0' // This should be filtered out
      };

      const result = extract_remotes_dependencies(mfConfig, packageDeps);
      
      expect(result).toEqual([
        { name: 'zephyr-mfe1', version: '1.0.0' },
        { name: 'zephyr-mfe2', version: '2.0.0' }
      ]);
    });
  });

  describe('generateRuntimePlugin', () => {
    it('should generate runtime plugin with resolved remotes', () => {
      const resolvedRemotes = [
        { name: 'mfe1', version: '1.0.0' },
        { name: 'mfe2', version: '2.0.0' }
      ];
      const edgeUrl = 'https://edge.example.com';

      const result = generateRuntimePlugin(resolvedRemotes, edgeUrl);
      
      expect(result).toContain('zephyr-runtime-remote-resolver');
      expect(result).toContain('beforeInit');
      expect(result).toContain('mfe1');
      expect(result).toContain('mfe2');
      expect(result).toContain(edgeUrl);
    });
  });

  describe('parseRuntimePlugin', () => {
    it('should parse runtime plugin code and find plugins array', () => {
      const code = `
        runtimeInit({
          name: 'test',
          plugins: [
            { name: 'existing-plugin' }
          ]
        });
      `;

      const result = parseRuntimePlugin(code);
      
      expect(result).not.toBeNull();
      expect(result?.hasExistingPlugins).toBe(true);
      expect(typeof result?.start).toBe('number');
      expect(typeof result?.end).toBe('number');
    });

    it('should handle empty plugins array', () => {
      const code = `
        runtimeInit({
          name: 'test',
          plugins: []
        });
      `;

      const result = parseRuntimePlugin(code);
      
      expect(result).not.toBeNull();
      expect(result?.hasExistingPlugins).toBe(false);
    });
  });

  describe('load_resolved_remotes', () => {
    it('should inject resolved remotes into runtime code', () => {
      const code = `
        runtimeInit({
          name: 'test',
          plugins: []
        });
      `;
      
      const resolvedRemotes = [
        { name: 'mfe1', version: '1.0.0' }
      ];

      const result = load_resolved_remotes(code, resolvedRemotes);
      
      expect(result).toContain('zephyr-runtime-remote-resolver');
      expect(result).toContain('mfe1');
      expect(result).toContain('1.0.0');
    });
  });

  describe('extract_mf_plugin', () => {
    it('should extract Vite Module Federation plugin', () => {
      const plugins = [
        { name: 'other-plugin' },
        { name: 'module-federation-vite', _options: { name: 'test', remotes: {} } },
        { name: 'another-plugin' }
      ];

      const result = extract_mf_plugin(plugins);
      
      expect(result).not.toBeNull();
      expect(result?._options?.name).toBe('test');
    });

    it('should extract Rolldown Module Federation plugin', () => {
      const plugins = [
        { name: 'other-plugin' },
        { name: 'module-federation-rolldown', config: { name: 'test', remotes: {} } },
        { name: 'another-plugin' }
      ];

      const result = extract_mf_plugin(plugins);
      
      expect(result).not.toBeNull();
      expect(result?.config?.name).toBe('test');
    });

    it('should return null when no MF plugin found', () => {
      const plugins = [
        { name: 'other-plugin' },
        { name: 'another-plugin' }
      ];

      const result = extract_mf_plugin(plugins);
      
      expect(result).toBeNull();
    });
  });

  describe('extractMFConfig', () => {
    it('should extract config from _options', () => {
      const plugin = {
        apply: () => {},
        _options: { name: 'test', remotes: {} }
      };

      const result = extractMFConfig(plugin);
      
      expect(result?.name).toBe('test');
    });

    it('should extract config from config property', () => {
      const plugin = {
        apply: () => {},
        config: { name: 'test', remotes: {} }
      };

      const result = extractMFConfig(plugin);
      
      expect(result?.name).toBe('test');
    });

    it('should handle nested config object', () => {
      const plugin = {
        apply: () => {},
        _options: { config: { name: 'test', remotes: {} } }
      };

      const result = extractMFConfig(plugin);
      
      expect(result?.name).toBe('test');
    });
  });
});