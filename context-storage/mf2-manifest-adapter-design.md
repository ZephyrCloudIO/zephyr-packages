# Module Federation 2.0 Manifest Adapter Design

This document outlines the design for adapters that will convert between Module Federation 2.0 manifests and Zephyr manifests, enabling seamless integration between the two systems.

## Manifest Format Comparison

### MF 2.0 Manifest (federation-manifest.json)

```typescript
interface MF2Manifest {
  id: string;
  name: string;
  metaData: {
    name: string;
    publicPath: string;
    type: string;
    buildInfo: {
      buildVersion: string;
    };
    remoteEntry: {
      name: string;
      path: string;
      type: string;
    };
    types: {
      name: string;
      path: string;
      zip?: string;
      api?: string;
    };
    globalName: string;
    pluginVersion?: string;
  };
  remotes: Array<{
    federationContainerName: string;
    moduleName: string;
    alias: string;
    entry: string;
    usedIn?: string[];
  }>;
  shared: Array<{
    id: string;
    name: string;
    version: string;
    singleton?: boolean;
    requiredVersion?: string;
    assets: {
      js: {
        async: string[];
        sync: string[];
      };
      css: {
        async: string[];
        sync: string[];
      };
    };
  }>;
  exposes: Array<{
    id: string;
    name: string;
    path: string;
    assets: {
      js: {
        sync: string[];
        async: string[];
      };
      css: {
        sync: string[];
        async: string[];
      };
    };
  }>;
}
```

### Zephyr Manifest (Snapshot)

```typescript
interface Snapshot {
  application_uid: string;
  version: string;
  snapshot_id: string;
  domain: string;
  uid: {
    build: string;
    app_name: string;
    repo: string;
    org: string;
  };
  git: {
    name?: string;
    email?: string;
    branch: string;
    commit: string;
  };
  creator: {
    name: string;
    email: string;
  };
  createdAt: number;
  mfConfig?: {
    name: string;
    filename: string;
    exposes?: Record<string, string>;
    remotes?: Record<string, string>;
    shared?: Record<string, unknown>;
  };
  assets: Record<string, SnapshotAsset>;
}

interface SnapshotAsset {
  path: string;
  extname: string;
  hash: string;
  size: number;
}
```

## Adapter Design

We will create a bidirectional adapter that can convert between the two formats while preserving all necessary information. The adapter will handle:

1. Converting MF 2.0 manifest to Zephyr Snapshot format
2. Converting Zephyr Snapshot format to MF 2.0 manifest
3. Ensuring backward compatibility with existing Zephyr implementations
4. Preserving all necessary metadata for both systems

### Adapter Interface

```typescript
interface MF2ManifestAdapter {
  /**
   * Convert an MF 2.0 manifest to a Zephyr Snapshot
   */
  toZephyrSnapshot(mf2Manifest: MF2Manifest): Snapshot;

  /**
   * Convert a Zephyr Snapshot to an MF 2.0 manifest
   */
  toMF2Manifest(snapshot: Snapshot): MF2Manifest;

  /**
   * Check if a given object is a valid MF 2.0 manifest
   */
  isValidMF2Manifest(manifest: unknown): manifest is MF2Manifest;

  /**
   * Extract MF 2.0 specific information from a Zephyr Snapshot
   */
  extractMF2InfoFromSnapshot(snapshot: Snapshot): Partial<MF2Manifest>;

  /**
   * Enrich a Zephyr Snapshot with MF 2.0 specific information
   */
  enrichSnapshotWithMF2Info(snapshot: Snapshot, mf2Info: Partial<MF2Manifest>): Snapshot;
}
```

### Implementation Approach

#### Converting MF 2.0 -> Zephyr (toZephyrSnapshot)

1. Map basic metadata: `name`, `id` -> `application_uid`, `name`
2. Convert metaData.buildInfo.buildVersion -> `version`
3. Construct snapshot_id from version and application_uid
4. Convert remoteEntry info to Zephyr format
5. Convert exposes to Zephyr format (Record<string, string>)
6. Convert remotes to Zephyr format (Record<string, string>)
7. Store detailed MF 2.0 information in a special field within the Snapshot
8. Convert MF 2.0 assets format to Zephyr format

#### Converting Zephyr -> MF 2.0 (toMF2Manifest)

1. Map application_uid, name -> `id`, `name`
2. Convert version -> metaData.buildInfo.buildVersion
3. Construct metaData from available Zephyr data
4. Convert Zephyr mfConfig to remotes, exposes formats
5. Extract detailed MF 2.0 data (if previously stored)
6. Reconstruct asset formats, splitting into sync/async as appropriate
7. Set defaults for required fields that might be missing

### Enhanced Manifest Storage

To ensure backward compatibility while supporting MF 2.0 features, we'll extend the Zephyr Snapshot interface with an optional field:

```typescript
interface SnapshotExtended extends Snapshot {
  // Version of the manifest format
  _manifestVersion?: string;
  
  // MF 2.0 specific data that doesn't map directly to Zephyr format
  _mf2Data?: {
    metaData?: Record<string, unknown>;
    shared?: Array<Record<string, unknown>>;
    remotes?: Array<Record<string, unknown>>;
    exposes?: Array<Record<string, unknown>>;
    assets?: Record<string, unknown>;
  };
}
```

### Version Detection and Migration

The adapter will include logic to detect the manifest version and handle migration:

```typescript
function detectManifestVersion(manifest: unknown): 'MF1' | 'MF2' | 'ZEPHYR' | 'UNKNOWN' {
  if (typeof manifest !== 'object' || manifest === null) {
    return 'UNKNOWN';
  }
  
  // Check for MF 2.0 pattern
  if ('id' in manifest && 'metaData' in manifest && 'remotes' in manifest && 'exposes' in manifest) {
    return 'MF2';
  }
  
  // Check for Zephyr pattern
  if ('application_uid' in manifest && 'snapshot_id' in manifest && 'assets' in manifest) {
    return 'ZEPHYR';
  }
  
  // Check for MF 1.0 pattern
  if ('mfConfig' in manifest && typeof manifest.mfConfig === 'object') {
    return 'MF1';
  }
  
  return 'UNKNOWN';
}
```

### Asset Conversion Logic

Converting between the different asset formats is a key challenge:

#### MF 2.0 to Zephyr

```typescript
function convertMF2AssetsToZephyr(
  mf2Assets: MF2Manifest['exposes'][0]['assets'] | MF2Manifest['shared'][0]['assets']
): Record<string, SnapshotAsset> {
  const result: Record<string, SnapshotAsset> = {};
  
  // Process JS assets
  [...mf2Assets.js.sync, ...mf2Assets.js.async].forEach(assetPath => {
    const parts = assetPath.split('/');
    const filename = parts[parts.length - 1];
    const [name, hash] = filename.split('.');
    
    result[assetPath] = {
      path: assetPath,
      extname: '.js',
      hash: hash || '',
      size: 0, // Size will be filled in later
    };
  });
  
  // Process CSS assets
  [...mf2Assets.css.sync, ...mf2Assets.css.async].forEach(assetPath => {
    const parts = assetPath.split('/');
    const filename = parts[parts.length - 1];
    const [name, hash] = filename.split('.');
    
    result[assetPath] = {
      path: assetPath,
      extname: '.css',
      hash: hash || '',
      size: 0, // Size will be filled in later
    };
  });
  
  return result;
}
```

#### Zephyr to MF 2.0

```typescript
function convertZephyrAssetsToMF2(
  zephyrAssets: Record<string, SnapshotAsset>,
  syncAssetPaths: string[] = []
): MF2Manifest['exposes'][0]['assets'] {
  const result = {
    js: {
      sync: [] as string[],
      async: [] as string[],
    },
    css: {
      sync: [] as string[],
      async: [] as string[],
    },
  };
  
  Object.entries(zephyrAssets).forEach(([path, asset]) => {
    const isSync = syncAssetPaths.includes(path);
    
    if (asset.extname === '.js') {
      if (isSync) {
        result.js.sync.push(path);
      } else {
        result.js.async.push(path);
      }
    } else if (asset.extname === '.css') {
      if (isSync) {
        result.css.sync.push(path);
      } else {
        result.css.async.push(path);
      }
    }
  });
  
  return result;
}
```

## Implementation Strategy

1. Create a new class `MF2ManifestAdapter` that implements the interface described above
2. Add version detection and migration utilities
3. Implement bidirectional conversion between formats
4. Add validation functions for both formats
5. Extend Zephyr's manifest handling to use the adapter when MF 2.0 is detected
6. Update storage format to include version information
7. Implement backward compatibility with existing Zephyr implementations

## Usage Examples

### Converting MF 2.0 Manifest to Zephyr

```typescript
const adapter = new MF2ManifestAdapter();
const mf2Manifest = JSON.parse(fs.readFileSync('federation-manifest.json', 'utf-8'));

if (adapter.isValidMF2Manifest(mf2Manifest)) {
  const snapshot = adapter.toZephyrSnapshot(mf2Manifest);
  // Use the snapshot with existing Zephyr code
}
```

### Converting Zephyr Snapshot to MF 2.0

```typescript
const adapter = new MF2ManifestAdapter();
const snapshot = getSnapshotFromZephyr(); // Existing Zephyr function

const mf2Manifest = adapter.toMF2Manifest(snapshot);
// Use the MF 2.0 manifest with MF 2.0 runtime
```

## Testing Strategy

1. Create unit tests with sample manifests from both systems
2. Test round-trip conversions to ensure no data is lost
3. Test handling of edge cases (missing fields, unexpected values)
4. Test backward compatibility with existing Zephyr implementations
5. Test integration with actual build outputs from both systems