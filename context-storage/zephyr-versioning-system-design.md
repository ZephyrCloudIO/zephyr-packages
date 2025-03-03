# Zephyr Versioning System Design

This document outlines the design for a versioning system for ~/.zephyr files to ensure backward compatibility while supporting new features like Module Federation 2.0.

## Current State

Currently, Zephyr stores various data in the ~/.zephyr directory without explicit versioning:

- Remote dependency resolution information
- Asset hashes and metadata
- Build configuration
- Runtime dependencies

This works well for the current implementation but lacks a mechanism to handle format changes over time, which will be necessary for supporting MF 2.0.

## Goals of the Versioning System

1. Enable backward compatibility with existing ~/.zephyr files
2. Support incremental adoption of new features
3. Provide clean migration paths between versions
4. Minimize disruption to existing workflows
5. Enable feature detection in the codebase

## Versioning Strategy

### Version Field Addition

We will add a version field to all persistent data structures:

```typescript
interface VersionedData<T> {
  version: string;
  data: T;
}
```

The version string will follow semantic versioning (MAJOR.MINOR.PATCH), where:
- MAJOR: Incompatible changes requiring migration
- MINOR: New features, backward compatible
- PATCH: Bug fixes, backward compatible

### File Structure

The file structure will be updated to include version information:

```
~/.zephyr/
  ├── version.json              # Global version information
  ├── config.json               # Configuration (versioned)
  ├── dependencies/             # Remote dependencies
  │   ├── index.json            # Index file (versioned)
  │   └── [dependency-id].json  # Individual dependency data (versioned)
  ├── assets/                   # Asset information
  │   ├── index.json            # Index file (versioned)
  │   └── [asset-hash].json     # Individual asset data (versioned)
  └── manifests/                # Stored manifests
      ├── index.json            # Index file (versioned)
      └── [manifest-id].json    # Individual manifest data (versioned)
```

### Version Detection and Migration

The system will include logic to detect versions and perform migrations when needed:

```typescript
function detectAndMigrateIfNeeded(filePath: string): VersionedData<unknown> {
  const content = fs.readFileSync(filePath, 'utf-8');
  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch (e) {
    // Handle corrupted files
    return createDefaultData();
  }

  if (isVersionedData(data)) {
    // Already versioned, check if migration needed
    return migrateIfNeeded(data);
  }

  // Legacy unversioned data, wrap and migrate
  return migrateIfNeeded({
    version: '0.0.0',
    data
  });
}

function migrateIfNeeded(versionedData: VersionedData<unknown>): VersionedData<unknown> {
  const currentVersion = getCurrentVersion();
  
  if (versionedData.version === currentVersion) {
    return versionedData;
  }

  // Apply migrations in sequence
  const migrations = getMigrationsBetween(versionedData.version, currentVersion);
  
  return migrations.reduce(
    (data, migration) => migration(data),
    versionedData
  );
}
```

### Migration Framework

We'll implement a migration framework to handle transitions between versions:

```typescript
interface Migration {
  fromVersion: string;
  toVersion: string;
  migrate: (data: VersionedData<unknown>) => VersionedData<unknown>;
}

const migrations: Migration[] = [
  {
    fromVersion: '0.0.0',
    toVersion: '1.0.0',
    migrate: (data) => {
      // Convert legacy format to 1.0.0 format
      return {
        version: '1.0.0',
        data: transformLegacyData(data.data)
      };
    }
  },
  {
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    migrate: (data) => {
      // Add MF 2.0 support fields
      return {
        version: '1.1.0',
        data: addMF2Support(data.data)
      };
    }
  }
  // Additional migrations as needed
];

function getMigrationsBetween(fromVersion: string, toVersion: string): Array<Migration['migrate']> {
  // Create a graph of migrations
  const migrationGraph = buildMigrationGraph(migrations);
  
  // Find shortest path from fromVersion to toVersion
  const path = findShortestPath(migrationGraph, fromVersion, toVersion);
  
  // Return the sequence of migration functions
  return path.map(version => {
    const migration = migrations.find(m => 
      m.fromVersion === version.from && m.toVersion === version.to
    );
    return migration!.migrate;
  });
}
```

## Version-Specific Features

The versioning system will enable feature detection in the codebase:

```typescript
function supportsFeature(feature: string, version: string): boolean {
  const featureSupport = {
    'mf2-manifest': compareVersions(version, '1.1.0') >= 0,
    'runtime-plugins': compareVersions(version, '1.2.0') >= 0,
    'fallback-strategies': compareVersions(version, '1.3.0') >= 0,
    // Other features
  };
  
  return featureSupport[feature] || false;
}
```

This allows code to conditionally use features based on the detected version.

## Proposed Versions and Features

### v0.0.0 (Legacy)
- Unversioned data
- Basic MF 1.0 support
- Simple asset tracking

### v1.0.0 (Initial Versioned)
- Added version field
- Structured directory layout
- Improved error handling
- Same feature set as v0.0.0

### v1.1.0 (MF 2.0 Manifest Support)
- Added support for MF 2.0 manifest format
- Enhanced asset tracking with sync/async classification
- Extended metadata fields

### v1.2.0 (Runtime Plugins)
- Support for MF 2.0 runtime plugins
- Configuration storage for plugins
- Plugin versioning

### v1.3.0 (Advanced Features)
- Fallback strategies
- Retry mechanisms
- Enhanced version resolution
- Server-side rendering support

## Implementation Strategy

1. Add version field to all data structures
2. Implement version detection and migration framework
3. Create initial migration from legacy to v1.0.0
4. Update all file read/write operations to use versioned format
5. Implement feature detection based on version
6. Add new migrations as features are implemented

## Backward Compatibility

To ensure backward compatibility:

1. All migrations must be lossless (no data loss during migration)
2. Legacy format must be automatically detected and migrated
3. Applications using older APIs should continue to work
4. Error handling should be robust for mixed version scenarios
5. Downgrades should be supported where possible

## Testing Strategy

1. Create test fixtures for each version format
2. Test migrations between all version pairs
3. Test feature detection
4. Test interaction with real ~/.zephyr directories
5. Test error handling and recovery
6. Test with a mix of legacy and new code

## Deployment Considerations

1. Include migration code in all new Zephyr releases
2. Provide CLI tools to manually trigger migrations
3. Add health checks and diagnostics for ~/.zephyr structure
4. Document migration paths for users
5. Implement backup mechanisms before migrations