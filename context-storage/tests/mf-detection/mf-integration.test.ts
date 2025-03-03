/**
 * MF Integration Tests
 * 
 * These tests validate the integration of MF 1.0 and 2.0 detection
 * with runtime code generation.
 */

import { 
  MFVersion,
  getMFVersionFromPlugin,
  createMFConfigExtractor
} from '../../enhanced-plugin-detection';

import {
  createMfRuntimeCode
} from '../../enhanced-runtime-code-generation';

describe('MF Integration', () => {
  // MF 1.0 Plugin Mock
  const mf1Plugin = {
    constructor: { name: 'ModuleFederationPlugin' },
    _options: {
      name: 'mf1Host',
      filename: 'remoteEntry.js',
      library: { type: 'var' },
      remotes: {
        mf1Remote: 'mf1Remote@http://localhost:3001/remoteEntry.js'
      }
    }
  };

  // MF 2.0 Plugin Mock
  const mf2Plugin = {
    constructor: { name: '@module-federation/enhanced/NativeFederationPlugin' },
    _options: {
      name: 'mf2Host',
      filename: 'remoteEntry.js',
      library: { type: 'module' },
      remotes: [
        { alias: 'mf2Remote', entry: 'http://localhost:3002/remoteEntry.js' }
      ],
      runtimePlugins: [
        { name: 'retry-plugin' }
      ]
    }
  };

  test('should integrate MF 1.0 detection with runtime code generation', () => {
    // Detect MF version
    const version = getMFVersionFromPlugin(mf1Plugin);
    expect(version).toBe(MFVersion.MF1);
    
    // Extract config
    const extractor = createMFConfigExtractor(mf1Plugin);
    expect(extractor.getMFVersion()).toBe(MFVersion.MF1);
    
    // Get relevant properties
    const name = extractor.extractName();
    const filename = extractor.extractFilename();
    const libraryType = extractor.extractLibraryType();
    const remotes = extractor.extractRemotes();
    
    // Validate extracted info
    expect(name).toBe('mf1Host');
    expect(filename).toBe('remoteEntry.js');
    expect(libraryType).toBe('var');
    expect(remotes).toHaveProperty('mf1Remote');
    
    // Create dependency object
    const remoteName = 'mf1Remote';
    const remoteEntryUrl = remotes[remoteName];
    
    const dependency = {
      name: remoteName,
      application_uid: `ze-${name}-${remoteName}`,
      remote_entry_url: remoteEntryUrl,
      default_url: remoteEntryUrl,
      library_type: libraryType || 'var',
      mfVersion: version
    };
    
    // Generate runtime code
    const code = createMfRuntimeCode(dependency, version);
    
    // Validate the generated code has the right properties
    expect(code).toContain(remoteName);
    expect(code).toContain(remoteEntryUrl);
    expect(code).not.toContain('attemptLoadWithRetry'); // MF 1.0 shouldn't have retry
  });

  test('should integrate MF 2.0 detection with runtime code generation', () => {
    // Detect MF version
    const version = getMFVersionFromPlugin(mf2Plugin);
    expect(version).toBe(MFVersion.MF2);
    
    // Extract config
    const extractor = createMFConfigExtractor(mf2Plugin);
    expect(extractor.getMFVersion()).toBe(MFVersion.MF2);
    
    // Get relevant properties
    const name = extractor.extractName();
    const filename = extractor.extractFilename();
    const libraryType = extractor.extractLibraryType();
    const remotes = extractor.extractRemotes();
    const runtimePlugins = extractor.extractRuntimePlugins();
    
    // Validate extracted info
    expect(name).toBe('mf2Host');
    expect(filename).toBe('remoteEntry.js');
    expect(libraryType).toBe('module');
    expect(remotes).toHaveProperty('mf2Remote');
    expect(runtimePlugins).toHaveLength(1);
    
    // Create dependency object
    const remoteName = 'mf2Remote';
    const remoteEntryUrl = remotes[remoteName];
    
    const dependency = {
      name: remoteName,
      application_uid: `ze-${name}-${remoteName}`,
      remote_entry_url: remoteEntryUrl,
      default_url: remoteEntryUrl,
      library_type: libraryType || 'var',
      mfVersion: version
    };
    
    // Generate runtime code
    const code = createMfRuntimeCode(dependency, version);
    
    // Validate the generated code has the right properties
    expect(code).toContain(remoteName);
    expect(code).toContain(remoteEntryUrl);
    expect(code).toContain('attemptLoadWithRetry'); // MF 2.0 should have retry
    expect(code).toContain('MAX_RETRIES'); // MF 2.0 should have retry config
    expect(code).toContain("'get' in mod"); // MF 2.0 should check for container protocol
  });
});