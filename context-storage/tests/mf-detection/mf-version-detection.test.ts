/**
 * MF Version Detection Tests
 * 
 * These tests validate the detection of Module Federation versions (1.0 and 2.0).
 */

import { 
  MFVersion,
  isModuleFederationPlugin,
  getMFVersionFromPlugin,
  createMFConfigExtractor
} from '../../enhanced-plugin-detection';

describe('Module Federation Version Detection', () => {
  // MF 1.0 Plugin Mocks
  const mf1Plugin = {
    constructor: { name: 'ModuleFederationPlugin' },
    _options: {
      name: 'mf1Host',
      filename: 'remoteEntry.js',
      remotes: {
        mf1Remote: 'mf1Remote@http://localhost:3001/remoteEntry.js'
      },
      exposes: {
        './Button': './src/Button'
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true }
      }
    }
  };

  const mf1PluginAlternative = {
    name: 'ModuleFederationPlugin',
    config: {
      name: 'mf1HostAlt',
      remotes: {
        mf1Remote: 'mf1Remote@http://localhost:3001/remoteEntry.js'
      }
    }
  };

  // MF 2.0 Plugin Mocks
  const mf2Plugin = {
    constructor: { name: '@module-federation/enhanced/NativeFederationPlugin' },
    _options: {
      name: 'mf2Host',
      filename: 'remoteEntry.js',
      remotes: [
        { alias: 'mf2Remote', entry: 'http://localhost:3002/remoteEntry.js' }
      ],
      exposes: [
        { name: './Button', path: './src/Button' }
      ],
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true }
      },
      runtimePlugins: [
        { name: 'retry-plugin' }
      ]
    }
  };

  const mf2PluginAlternative = {
    name: '@module-federation/enhanced',
    config: {
      name: 'mf2HostAlt',
      remotes: [
        { alias: 'mf2Remote', entry: 'http://localhost:3002/remoteEntry.js' }
      ],
      manifestPlugin: {
        outputPath: 'mf-manifest.json'
      }
    }
  };

  // Non-MF Plugin Mocks
  const nonMfPlugin = {
    constructor: { name: 'HtmlWebpackPlugin' },
    _options: {
      template: './src/index.html'
    }
  };

  // Tests for isModuleFederationPlugin function
  describe('isModuleFederationPlugin', () => {
    test('should detect MF 1.0 plugins correctly', () => {
      expect(isModuleFederationPlugin(mf1Plugin)).toBe(true);
      expect(isModuleFederationPlugin(mf1PluginAlternative)).toBe(true);
    });

    test('should detect MF 2.0 plugins correctly', () => {
      expect(isModuleFederationPlugin(mf2Plugin)).toBe(true);
      expect(isModuleFederationPlugin(mf2PluginAlternative)).toBe(true);
    });

    test('should reject non-MF plugins', () => {
      expect(isModuleFederationPlugin(nonMfPlugin)).toBe(false);
      expect(isModuleFederationPlugin({})).toBe(false);
      expect(isModuleFederationPlugin(null)).toBe(false);
      expect(isModuleFederationPlugin(undefined)).toBe(false);
    });
  });

  // Tests for getMFVersionFromPlugin function
  describe('getMFVersionFromPlugin', () => {
    test('should detect MF 1.0 version correctly', () => {
      expect(getMFVersionFromPlugin(mf1Plugin)).toBe(MFVersion.MF1);
      expect(getMFVersionFromPlugin(mf1PluginAlternative)).toBe(MFVersion.MF1);
    });

    test('should detect MF 2.0 version correctly', () => {
      expect(getMFVersionFromPlugin(mf2Plugin)).toBe(MFVersion.MF2);
      expect(getMFVersionFromPlugin(mf2PluginAlternative)).toBe(MFVersion.MF2);
    });

    test('should return UNKNOWN for non-MF plugins', () => {
      expect(getMFVersionFromPlugin(nonMfPlugin)).toBe(MFVersion.UNKNOWN);
      expect(getMFVersionFromPlugin({})).toBe(MFVersion.UNKNOWN);
    });
  });

  // Tests for createMFConfigExtractor function
  describe('createMFConfigExtractor', () => {
    test('should create MF1ConfigExtractor for MF 1.0 plugins', () => {
      const extractor = createMFConfigExtractor(mf1Plugin);
      expect(extractor.getMFVersion()).toBe(MFVersion.MF1);
    });

    test('should create MF2ConfigExtractor for MF 2.0 plugins', () => {
      const extractor = createMFConfigExtractor(mf2Plugin);
      expect(extractor.getMFVersion()).toBe(MFVersion.MF2);
    });

    test('should extract configuration correctly from MF 1.0 plugins', () => {
      const extractor = createMFConfigExtractor(mf1Plugin);
      
      expect(extractor.extractName()).toBe('mf1Host');
      expect(extractor.extractFilename()).toBe('remoteEntry.js');
      
      const remotes = extractor.extractRemotes();
      expect(remotes).toHaveProperty('mf1Remote');
      expect(remotes.mf1Remote).toBe('mf1Remote@http://localhost:3001/remoteEntry.js');
      
      const exposes = extractor.extractExposes();
      expect(exposes).toEqual(expect.objectContaining({'./Button': './src/Button'}));
      
      const shared = extractor.extractShared();
      expect(shared).toHaveProperty('react');
      expect(shared.react).toHaveProperty('singleton', true);
      
      const runtimePlugins = extractor.extractRuntimePlugins();
      expect(runtimePlugins).toEqual([]);
    });

    test('should extract configuration correctly from MF 2.0 plugins', () => {
      const extractor = createMFConfigExtractor(mf2Plugin);
      
      expect(extractor.extractName()).toBe('mf2Host');
      expect(extractor.extractFilename()).toBe('remoteEntry.js');
      
      const remotes = extractor.extractRemotes();
      expect(remotes).toHaveProperty('mf2Remote');
      
      const exposes = extractor.extractExposes();
      expect(exposes).toEqual(expect.objectContaining({'./Button': './src/Button'}));
      
      const shared = extractor.extractShared();
      expect(shared).toHaveProperty('react');
      expect(shared.react).toHaveProperty('singleton', true);
      
      const runtimePlugins = extractor.extractRuntimePlugins();
      expect(runtimePlugins).toHaveLength(1);
      expect(runtimePlugins[0]).toHaveProperty('name', 'retry-plugin');
    });
  });
});