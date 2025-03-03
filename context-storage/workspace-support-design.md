# Workspace Support Design Document

## Overview

This document outlines the design for implementing workspace support in the Zephyr packages system. It builds upon the URL encoding functionality implemented in Phase 2.1, extending it to handle package resolution in monorepo workspace environments like pnpm and yarn.

## Key Requirements

1. Support for multiple workspace formats:
   - pnpm workspaces (pnpm-workspace.yaml)
   - yarn workspaces (package.json workspaces field)

2. Package traversal capabilities:
   - Resolve glob patterns to find workspace packages
   - Extract package metadata (name, version, dependencies)
   - Handle nested packages and excludes

3. Cross-workspace dependency resolution:
   - Resolve dependencies between workspace packages
   - Detect and handle version conflicts
   - Support overrides for conflict resolution

4. Integration with URL encoding:
   - Properly encode workspace package names
   - Resolve encoded names within workspace context
   - Generate URLs for workspace packages

## Design Architecture

### Core Components

1. **Workspace Parser**:
   - `WorkspaceType` enum to differentiate workspace formats
   - `WorkspaceConfig` interface for unified representation
   - Parser factories for different workspace formats

2. **Package Traversal System**:
   - Glob pattern resolution
   - Package.json parsing
   - Metadata extraction

3. **Dependency Resolution System**:
   - Workspace dependency graph construction
   - Version conflict detection
   - Override application

4. **Caching System**:
   - Workspace configuration cache
   - Package metadata cache
   - Resolution result cache

### Data Structures

#### Workspace Configuration

```typescript
enum WorkspaceType {
  PNPM,
  YARN
}

interface WorkspaceConfig {
  type: WorkspaceType;
  root: string;
  patterns: string[];
  excludes: string[];
}
```

#### Workspace Package

```typescript
interface WorkspacePackage {
  name: string;
  path: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  isWorkspaceDependency?: boolean;
}
```

#### Version Conflict

```typescript
interface VersionConflict {
  package: string;
  versions: Array<{
    version: string;
    requiredBy: string[];
  }>;
}
```

### Workflow Diagrams

#### Workspace Discovery
```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│ Detect      │     │ Parse       │     │ Return       │
│ Workspace   │────▶│ Workspace   │────▶│ Workspace    │
│ Type        │     │ Config      │     │ Config       │
└─────────────┘     └─────────────┘     └──────────────┘
```

#### Package Traversal
```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│ Resolve     │     │ Parse       │     │ Extract      │
│ Glob        │────▶│ Package     │────▶│ Metadata     │
│ Patterns    │     │ Files       │     │              │
└─────────────┘     └─────────────┘     └──────────────┘
       │                                        │
       └───────────────────┬──────────────────┘
                           ▼
                  ┌──────────────────┐
                  │ Return Workspace │
                  │ Packages Array   │
                  └──────────────────┘
```

#### Dependency Resolution
```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│ Build       │     │ Resolve     │     │ Apply        │
│ Dependency  │────▶│ Dependencies│────▶│ Overrides    │
│ Graph       │     │             │     │              │
└─────────────┘     └─────────────┘     └──────────────┘
       │                                        │
       └───────────────────┬──────────────────┘
                           ▼
                 ┌───────────────────┐
                 │ Return Resolved   │
                 │ Dependencies Map  │
                 └───────────────────┘
```

## Implementation Approach

### PNPM Workspace Support

1. **PNPM Workspace Parsing**:
   - Read and parse pnpm-workspace.yaml
   - Extract package patterns and excludes
   - Create normalized WorkspaceConfig object

2. **Package Traversal**:
   - Implement glob resolution for patterns
   - Apply exclude patterns
   - Read package.json files
   - Extract metadata

### Yarn Workspace Support

1. **Yarn Workspace Parsing**:
   - Read and parse package.json workspaces field
   - Support both array and object formats
   - Extract nohoist configurations

2. **Workspace: Protocol Handling**:
   - Parse workspace: protocol references
   - Implement version range resolution
   - Support * and ^ version ranges

### Cross-Workspace Resolution

1. **Dependency Graph**:
   - Build directed graph of package dependencies
   - Detect cycles in dependency graph
   - Efficiently traverse graph for resolution

2. **Version Conflict Resolution**:
   - Detect conflicting version requirements
   - Apply resolution strategies:
     - Nearest wins
     - Root wins
     - Explicit overrides

3. **Overrides System**:
   - Support package.json resolutions field
   - Support command-line overrides
   - Merge multiple override sources

### Performance Optimizations

1. **Caching Strategy**:
   - Cache workspace configuration
   - Cache package metadata
   - Cache resolution results
   - Implement LRU eviction policy

2. **Lazy Loading**:
   - Defer package.json parsing until needed
   - Implement partial graph traversal
   - Support incremental dependency resolution

3. **Parallel Processing**:
   - Implement parallel traversal for large workspaces
   - Use worker threads for package.json parsing
   - Balance parallelism based on system capabilities

## Integration with URL Encoding

The workspace functionality will integrate with the URL encoding implementation from Phase 2.1:

1. **Package Name Encoding**:
   - Encode workspace package names for URL safety
   - Preserve workspace structure in encoded names
   - Handle special characters in workspace package names

2. **Resolution with Encoded Names**:
   - Support lookup by encoded package name
   - Convert between encoded and original names
   - Ensure roundtrip safety

3. **URL Generation**:
   - Generate URLs for workspace packages
   - Use encoded names in URL paths
   - Support version-specific URLs

## Edge Cases and Considerations

1. **Private Packages**:
   - Handle packages with private: true
   - Support organizations with mixed public/private packages
   - Respect publishConfig settings

2. **Nested Workspaces**:
   - Support nested workspace configurations
   - Handle inheritance of workspace settings
   - Resolve dependencies across nested workspaces

3. **Hoisting Behavior**:
   - Account for different hoisting strategies
   - Support nohoist configurations
   - Handle workspace-specific node_modules

4. **Version Ranges**:
   - Support complex semver ranges
   - Handle pre-release versions
   - Support range intersections and unions

## Test Strategy

Following our TDD approach, we'll implement comprehensive tests covering:

1. **Unit Tests**:
   - PNPM workspace parsing
   - Yarn workspace parsing
   - Dependency resolution logic
   - Version conflict detection

2. **Integration Tests**:
   - Cross-workspace resolution
   - URL encoding integration
   - Override application

3. **Performance Tests**:
   - Large workspace benchmarks
   - Cache efficiency testing
   - Memory usage profiling

## Next Steps

1. Implement test files according to the test plan
2. Create stub implementation files
3. Iteratively implement features following TDD approach
4. Document implementation decisions and challenges
5. Prepare for integration with main codebase

## Appendix: Sample Configurations

### PNPM Workspace Example

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - '!**/test/**'
  - '!**/*.md'
```

### Yarn Workspace Example

```json
// package.json
{
  "name": "monorepo-root",
  "private": true,
  "workspaces": {
    "packages": [
      "packages/*",
      "apps/*"
    ],
    "nohoist": [
      "**/react",
      "**/react-dom"
    ]
  }
}
```

### Dependency Resolution Example

```json
// package.json
{
  "name": "monorepo-root",
  "private": true,
  "workspaces": ["packages/*"],
  "resolutions": {
    "lodash": "4.17.21",
    "@types/react": "17.0.0"
  }
}
```

---

Document created: 3/3/2025