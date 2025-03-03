# Backward Compatibility Implementation

This document outlines the implementation approach for ensuring backward compatibility when adding Module Federation 2.0 support to Zephyr packages.

## Compatibility Challenges

1. **Data Format Changes**: MF 2.0 uses a different manifest format than Zephyr's current format.
2. **Runtime Code Differences**: MF 2.0 has a different container protocol than MF 1.0.
3. **Configuration Format**: MF 2.0 plugins have additional configuration options.
4. **Asset Structure**: MF 2.0 has a more detailed asset classification system.
5. **Local Storage**: ~/.zephyr files need to support both formats.

## Backward Compatibility Strategies

### 1. Versioned Manifests

We will implement a versioned manifest system that can:
- Detect the manifest version automatically
- Convert between formats as needed
- Maintain backward compatibility with existing code

```typescript
class ManifestManager {
  /**
   * Detect manifest version and return appropriate handler
   */
  static getHandlerForManifest(manifest: unknown): ManifestHandler {
    const version = ManifestVersionDetector.detect(manifest);
    
    switch (version) {
      case 'MF1':
        return new MF1ManifestHandler(manifest);
      case 'MF2':
        return new MF2ManifestHandler(manifest);
      case 'ZEPHYR':
        return new ZephyrManifestHandler(manifest);
      default:
        throw new Error(`Unknown manifest version: ${version}`);
    }
  }
}

interface ManifestHandler {
  toZephyrFormat(): ZephyrSnapshot;
  getRemotes(): Record<string, string>;
  getExposes(): Record<string, string>;
  getShared(): Record<string, unknown>;
  getAssets(): Record<string, ZephyrAsset>;
}
```

### 2. Plugin Version Detection

We will enhance plugin detection to identify both MF 1.0 and 2.0 plugins:

```typescript
function isModuleFederationPlugin(plugin?: any): boolean {
  if (!plugin || typeof plugin !== 'object') return false;

  // Check for MF 1.0 pattern
  if (
    typeof plugin.constructor?.name?.includes === 'function' &&
    plugin.constructor.name?.includes('ModuleFederationPlugin')
  ) {
    return true;
  }

  // Check for MF 2.0 pattern
  if (
    typeof plugin.constructor?.name?.includes === 'function' &&
    plugin.constructor.name?.includes('@module-federation/enhanced')
  ) {
    return true;
  }

  // Check by plugin name (fallback)
  return Boolean(
    (plugin['name']?.includes && plugin['name']?.includes('ModuleFederationPlugin')) ||
    (plugin['name']?.includes && plugin['name']?.includes('@module-federation/enhanced'))
  );
}

function getMFVersionFromPlugin(plugin: any): 'MF1' | 'MF2' | 'unknown' {
  if (!plugin || typeof plugin !== 'object') return 'unknown';

  // Check for MF 2.0 pattern
  if (
    (typeof plugin.constructor?.name?.includes === 'function' &&
    plugin.constructor.name?.includes('@module-federation/enhanced')) ||
    (plugin['name']?.includes && plugin['name']?.includes('@module-federation/enhanced'))
  ) {
    return 'MF2';
  }

  // Check for MF 1.0 pattern
  if (
    (typeof plugin.constructor?.name?.includes === 'function' &&
    plugin.constructor.name?.includes('ModuleFederationPlugin')) ||
    (plugin['name']?.includes && plugin['name']?.includes('ModuleFederationPlugin'))
  ) {
    return 'MF1';
  }

  return 'unknown';
}
```

### 3. Configuration Extraction Abstraction

Create an abstraction layer for configuration extraction that works with both versions:

```typescript
interface MFConfigExtractor {
  extractRemotes(): Record<string, string>;
  extractExposes(): Record<string, string>;
  extractShared(): Record<string, unknown>;
  extractRuntimePlugins(): unknown[];
  getMFVersion(): 'MF1' | 'MF2';
}

class MF1ConfigExtractor implements MFConfigExtractor {
  constructor(private plugin: any) {}
  
  extractRemotes() {
    return this.plugin?._options?.remotes || {};
  }
  
  extractExposes() {
    return this.plugin?._options?.exposes || {};
  }
  
  extractShared() {
    return this.plugin?._options?.shared || {};
  }
  
  extractRuntimePlugins() {
    return []; // MF 1.0 doesn't support runtime plugins
  }
  
  getMFVersion() {
    return 'MF1';
  }
}

class MF2ConfigExtractor implements MFConfigExtractor {
  constructor(private plugin: any) {}
  
  extractRemotes() {
    // Handle both object and array formats
    const remotes = this.plugin?._options?.remotes || {};
    
    if (Array.isArray(remotes)) {
      return remotes.reduce((acc, remote) => {
        acc[remote.alias] = remote.entry;
        return acc;
      }, {});
    }
    
    return remotes;
  }
  
  extractExposes() {
    // Handle both object and array formats
    const exposes = this.plugin?._options?.exposes || {};
    
    if (Array.isArray(exposes)) {
      return exposes.reduce((acc, expose) => {
        acc[expose.name] = expose.path;
        return acc;
      }, {});
    }
    
    return exposes;
  }
  
  extractShared() {
    return this.plugin?._options?.shared || {};
  }
  
  extractRuntimePlugins() {
    return this.plugin?._options?.runtimePlugins || [];
  }
  
  getMFVersion() {
    return 'MF2';
  }
}
```

### 4. Runtime Code Generation

Implement version-specific runtime code generation:

```typescript
function createMFRuntimeCode(
  deps: ZeResolvedDependency,
  mfVersion: 'MF1' | 'MF2'
): string {
  switch (mfVersion) {
    case 'MF1':
      return createMF1RuntimeCode(deps);
    case 'MF2':
      return createMF2RuntimeCode(deps);
    default:
      throw new Error(`Unsupported MF version: ${mfVersion}`);
  }
}

function createMF1RuntimeCode(deps: ZeResolvedDependency): string {
  // Current implementation
  return xpack_delegate_module_template()
    .toString()
    .replace('__APPLICATION_UID__', deps.application_uid)
    .replace('__REMOTE_ENTRY_URL__', deps.remote_entry_url)
    .replace('__REMOTE_NAME__', deps.name)
    .replace('__LIBRARY_TYPE__', deps.library_type);
}

function createMF2RuntimeCode(deps: ZeResolvedDependency): string {
  // MF 2.0 implementation
  return mf2_delegate_module_template()
    .toString()
    .replace('__APPLICATION_UID__', deps.application_uid)
    .replace('__REMOTE_ENTRY_URL__', deps.remote_entry_url)
    .replace('__REMOTE_NAME__', deps.name)
    .replace('__LIBRARY_TYPE__', deps.library_type);
}

function mf2_delegate_module_template(): unknown {
  // MF 2.0 specific template with container protocol
  return new Promise((resolve, reject) => {
    const _windows = typeof window !== 'undefined' ? window : globalThis;
    const sessionEdgeURL = _windows.sessionStorage.getItem('__APPLICATION_UID__');
    
    const remote_entry_url = '__REMOTE_ENTRY_URL__';
    const library_type = '__LIBRARY_TYPE__';
    let edgeUrl = sessionEdgeURL ?? remote_entry_url;
    let remote_name = '__REMOTE_NAME__';
    
    if (edgeUrl.indexOf('@') !== -1) {
      [remote_name, edgeUrl] = edgeUrl.split('@') as [string, string];
    }
    
    // MF 2.0 specific loading mechanism
    import(edgeUrl)
      .then(container => {
        if (typeof container.get !== 'function') {
          // Fall back to MF 1.0 approach
          const _win = _windows as unknown as Record<string, unknown>;
          if (typeof _win[remote_name] !== 'undefined') {
            return resolve(_win[remote_name]);
          }
          return resolve(container);
        }
        
        // MF 2.0 container protocol
        return resolve(container);
      })
      .catch(error => {
        console.error(`Zephyr: error loading remote entry ${remote_entry_url}`, error);
        reject(error);
      });
  });
}
```

### 5. Versioned ~/.zephyr Files

Implement versioned local storage as described in the versioning system design:

```typescript
class ZephyrStorage {
  constructor(private basePath: string = path.join(os.homedir(), '.zephyr')) {}
  
  async read<T>(filePath: string): Promise<VersionedData<T>> {
    const fullPath = path.join(this.basePath, filePath);
    
    try {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const data = JSON.parse(content);
      
      if (this.isVersionedData(data)) {
        return data as VersionedData<T>;
      }
      
      // Legacy unversioned data
      return {
        version: '0.0.0',
        data: data as T
      };
    } catch (error) {
      // File doesn't exist or is invalid
      return {
        version: getCurrentVersion(),
        data: {} as T
      };
    }
  }
  
  async write<T>(filePath: string, data: T): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    
    const versionedData: VersionedData<T> = {
      version: getCurrentVersion(),
      data
    };
    
    await fs.promises.writeFile(
      fullPath,
      JSON.stringify(versionedData, null, 2),
      'utf-8'
    );
  }
  
  private isVersionedData(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      'data' in data
    );
  }
}
```

### 6. Feature Detection and Conditional Logic

Implement feature detection to conditionally use MF 2.0 features:

```typescript
class FeatureDetector {
  static isMF2Enabled(config: any): boolean {
    // Check if MF 2.0 plugin is being used
    if (config?.plugins) {
      for (const plugin of config.plugins) {
        if (getMFVersionFromPlugin(plugin) === 'MF2') {
          return true;
        }
      }
    }
    
    // Check for explicit opt-in via Zephyr config
    const zephyrConfig = getZephyrConfig(config);
    return Boolean(zephyrConfig?.enableMF2);
  }
  
  static isMF2ManifestSupported(): boolean {
    // Check if the current Zephyr version supports MF 2.0 manifests
    const currentVersion = getCurrentVersion();
    return compareVersions(currentVersion, '1.1.0') >= 0;
  }
  
  static areRuntimePluginsSupported(): boolean {
    // Check if the current Zephyr version supports runtime plugins
    const currentVersion = getCurrentVersion();
    return compareVersions(currentVersion, '1.2.0') >= 0;
  }
}
```

## Integration Points

### 1. Plugin Detection

Update the `isModuleFederationPlugin` function to detect both MF 1.0 and 2.0 plugins.

### 2. Configuration Extraction

Enhance the `iterateFederatedRemoteConfig` function to work with both MF versions:

```typescript
export function iterateFederatedRemoteConfig<Compiler, K = XFederatedRemotesConfig>(
  config: XPackConfiguration<Compiler>,
  for_remote: (federatedRemoteConfig: XFederatedRemotesConfig) => K
): K[] {
  if (!config.plugins) {
    return [];
  }

  const results: K[] = [];
  for (const plugin of config.plugins) {
    if (!isModuleFederationPlugin(plugin)) {
      continue;
    }
    
    // Get the appropriate extractor for this plugin
    const mfVersion = getMFVersionFromPlugin(plugin);
    const extractor = mfVersion === 'MF2' 
      ? new MF2ConfigExtractor(plugin)
      : new MF1ConfigExtractor(plugin);
    
    // Convert to common format and process
    const config: XFederatedRemotesConfig = {
      name: plugin._options?.name || '',
      remotes: extractor.extractRemotes(),
      exposes: extractor.extractExposes(),
      shared: extractor.extractShared(),
      // Add MF 2.0 specific fields if needed
      ...(mfVersion === 'MF2' ? {
        runtimePlugins: extractor.extractRuntimePlugins()
      } : {})
    };
    
    results.push(for_remote(config));
  }

  return results;
}
```

### 3. Manifest Generation

Update the manifest generation to handle both formats:

```typescript
function createSnapshot(context: string, mfVersion: 'MF1' | 'MF2'): ZephyrSnapshot {
  // Create base snapshot
  const snapshot = createBaseSnapshot(context);
  
  // Add MF version information
  if (mfVersion === 'MF2') {
    (snapshot as any)._mfVersion = 'MF2';
    
    // Add MF 2.0 specific fields
    // ...
  }
  
  return snapshot;
}
```

### 4. Runtime Code Injection

Update the runtime code injection to use the appropriate template:

```typescript
function mutWebpackFederatedRemotesConfig(
  config: XPackConfiguration<any>,
  resolveDeps: (deps: ZeDependencyPair[]) => Promise<ZeResolvedDependency[]>
): Promise<void> {
  // ... existing code
  
  for (const plugin of config.plugins || []) {
    if (!isModuleFederationPlugin(plugin)) {
      continue;
    }
    
    const mfVersion = getMFVersionFromPlugin(plugin);
    
    // ... resolve dependencies
    
    // Update remotes with version-specific code
    for (const [remote_name, remote_value] of Object.entries(remotes || {})) {
      const dep = resolvedDeps.find(d => d.name === remote_name);
      if (!dep) continue;
      
      remotes[remote_name] = createMFRuntimeCode(dep, mfVersion);
    }
  }
}
```

## Testing Strategy

1. **Unit Tests**: Create unit tests for each compatibility layer
2. **Integration Tests**: Test the entire flow with both MF 1.0 and 2.0 plugins
3. **Regression Tests**: Ensure existing MF 1.0 code continues to work
4. **Migration Tests**: Test migration of ~/.zephyr files
5. **Feature Detection Tests**: Ensure feature detection works correctly
6. **Edge Cases**: Test with mixed MF 1.0 and 2.0 configurations

## Deployment Strategy

1. **Phased Rollout**: Implement and deploy in phases
2. **Feature Flags**: Use feature flags to enable/disable new features
3. **Documentation**: Document backward compatibility considerations
4. **Migration Tools**: Provide tools to help users migrate
5. **Health Checks**: Add health checks to detect compatibility issues