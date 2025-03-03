# Cross-Cutting Concerns Analysis

This document identifies shared functionality and cross-cutting concerns between xpack (webpack/rspack) and rollx (rollup/rolldown/vite) bundler implementations.

## Methodology

1. Analyze existing implementations in context-storage
2. Identify duplicated code and shared patterns
3. Review feature implementations across different bundlers
4. Document common interfaces and abstractions

## Common Features

| Feature | Description | Current Implementation Locations | Shared Functionality |
|---------|-------------|----------------------------------|----------------------|
| BaseHref | Path handling for deployed assets | `/context-storage/basehref-implementation-skeleton.ts`<br>`/context-storage/basehref-vite-plugin.ts`<br>`/context-storage/basehref-webpack-plugin.ts` | - Path normalization<br>- URL construction<br>- Base path detection<br>- Runtime injection |
| Remote Types | Type definitions for federated modules | `/context-storage/remote-types-detection-skeleton.ts`<br>`/context-storage/remote-types-vite-plugin.ts`<br>`/context-storage/remote-types-webpack-plugin.ts` | - Type detection<br>- Type resolution<br>- Type manifest generation<br>- Framework detection |
| Remote Entry Structure Sharing | Metadata for federated modules | `/context-storage/remote-entry-structure-sharing-skeleton.ts`<br>`/context-storage/remote-types-sharing-integration.ts` | - Schema validation<br>- Metadata extraction<br>- Compatibility checking<br>- Manifest generation |

## Common Utilities and Services

| Utility | Description | Current Implementations | Abstraction Candidates |
|---------|-------------|-------------------------|------------------------|
| Path Utilities | Functions for path manipulation | Found across multiple files | - Path normalization<br>- Path joining<br>- URL path conversion<br>- Platform-specific handling |
| Manifest Handling | Creation and parsing of manifests | Found across multiple files | - Schema definitions<br>- Validation utilities<br>- Serialization/deserialization<br>- Version detection |
| Configuration | Config processing and normalization | Found across multiple files | - Option normalization<br>- Default values<br>- Schema validation<br>- Configuration merging |
| Remote Resolution | Resolving remote dependencies | Found across multiple files | - Remote URL construction<br>- Version resolution<br>- Fallback handling<br>- Caching strategies |

## Common Interfaces

| Interface | Purpose | Current Implementations | Common Contract |
|-----------|---------|-------------------------|----------------|
| Plugin Interface | Core plugin contract | Varies by bundler | - Initialization<br>- Hook registration<br>- Configuration<br>- Error handling |
| Feature Interface | Feature-specific contracts | Varies by feature | - Feature detection<br>- Implementation<br>- Integration hooks<br>- Configuration options |
| Manifest Interface | Metadata structures | Multiple files | - Schema validation<br>- Version information<br>- Compatibility checking<br>- Serialization format |
| Remote Interface | Remote module handling | Multiple files | - Remote discovery<br>- Loading strategies<br>- Error recovery<br>- Caching behavior |

## Dependencies

| Dependency | Usage | Shared Across | Notes |
|------------|-------|---------------|-------|
| Schema Validation | Validating configurations and manifests | All bundlers | Could be abstracted to common utility |
| Path Manipulation | Handling file paths and URLs | All bundlers | Should be centralized with platform-specific handling |
| Module Federation | Integration with federation | All bundlers | Core integration logic can be shared |
| Logging | Diagnostic information | All bundlers | Common logging interface needed |

## Plugin Lifecycle

| Lifecycle Phase | xpack Implementation | rollx Implementation | Common Abstraction |
|-----------------|----------------------|----------------------|-------------------|
| Initialization | Compiler initialization | Plugin initialization | Common init interface |
| Module Analysis | During compilation | During bundling | Module analysis abstraction |
| Asset Generation | Emit phase | Output phase | Asset generation interface |
| Manifest Creation | After compilation | After bundling | Manifest generation abstraction |
| Runtime Code Injection | Varied approaches | Varied approaches | Common injection strategy |

## Next Steps

1. Create core interfaces in zephyr-agent/zephyr-engine based on this analysis
2. Implement shared utilities identified above
3. Refactor existing code to use these abstractions
4. Ensure proper bundler-specific adaptations while maximizing shared code

## Implementation Priority

1. Core interfaces and contracts
2. Path and URL utilities
3. Schema validation and manifest handling
4. Remote resolution and discovery
5. Configuration normalization
6. Feature-specific abstractions (BaseHref, Remote Types, etc.)