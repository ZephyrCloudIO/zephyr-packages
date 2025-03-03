# Abstraction Implementation Plan

This document outlines the detailed implementation plan for moving cross-cutting concerns to the zephyr-agent/zephyr-engine.

## Phase 1: Core Setup and First Abstractions

### Step 1: Initialize Engine Directory Structure

```bash
mkdir -p /libs/zephyr-agent/src/lib/engine/{utils,validation,schema,detection,manifest,resolution,html,errors,cache,logging}
```

### Step 2: PathUtils Implementation ✅

**File**: `/libs/zephyr-agent/src/lib/engine/utils/path-utils.ts`

- Extract code from BasePathHandler, ViteBaseHandler, WebpackPathHandler
- Create comprehensive unit tests
- Document public API
- Focus on maintaining backward compatibility

**Status**: Initial implementation completed in analysis phase.

### Step 3: SchemaValidator Implementation ✅

**File**: `/libs/zephyr-agent/src/lib/engine/validation/schema-validator.ts`

- Extract validation logic from MetadataSchema, RemoteTypeConfig
- Implement generic schema validation pattern
- Create comprehensive unit tests
- Document validation patterns and best practices

**Status**: Initial implementation completed in analysis phase.

## Phase 2: Configuration and Detection

### Step 1: ConfigNormalizer Implementation ✅

**File**: `/libs/zephyr-agent/src/lib/engine/utils/config-normalizer.ts`

- Extract configuration handling from various plugins
- Create a unified approach to option normalization
- Ensure backward compatibility with existing code
- Create comprehensive unit tests

**Status**: Initial implementation completed in analysis phase.

### Step 2: FeatureDetector Implementation ✅

**File**: `/libs/zephyr-agent/src/lib/engine/detection/feature-detector.ts`

- Extract framework and render type detection code
- Implement bundler detection logic
- Ensure all detection methods are bundler-agnostic
- Create comprehensive unit tests

**Status**: Initial implementation completed in analysis phase.

## Phase 3: Remote Handling and Manifests

### Step 1: ManifestHandler Implementation

**File**: `/libs/zephyr-agent/src/lib/engine/manifest/manifest-handler.ts`

- Extract manifest generation and consumption code
- Create clear interface for manifest operations
- Ensure file system operations are abstracted appropriately
- Create comprehensive unit tests

### Step 2: RemoteResolver Implementation

**File**: `/libs/zephyr-agent/src/lib/engine/resolution/remote-resolver.ts`

- Extract remote URL construction and resolution logic
- Implement compatibility validation
- Ensure both browser and Node.js environments are supported
- Create comprehensive unit tests

## Phase 4: Runtime Support and HTML Processing

### Step 1: RuntimeDetector Implementation

**File**: `/libs/zephyr-agent/src/lib/engine/detection/runtime-detector.ts`

- Extract runtime detection code
- Ensure browser/Node.js environment detection
- Implement feature detection for runtime capabilities
- Create comprehensive unit tests

### Step 2: HtmlProcessor Implementation

**File**: `/libs/zephyr-agent/src/lib/engine/html/html-processor.ts`

- Extract HTML manipulation code
- Implement clean API for HTML operations
- Ensure proper HTML parsing and manipulation
- Create comprehensive unit tests

## Phase 5: Utility Services

### Step 1: ErrorHandler Implementation

**File**: `/libs/zephyr-agent/src/lib/engine/errors/error-handler.ts`

- Extract error handling logic
- Create a consistent error handling pattern
- Implement error categorization and formatting
- Create comprehensive unit tests

### Step 2: CacheManager Implementation

**File**: `/libs/zephyr-agent/src/lib/engine/cache/cache-manager.ts`

- Extract caching logic
- Implement a clean API for cache operations
- Ensure both memory and disk caching are supported
- Create comprehensive unit tests

### Step 3: Logger Implementation

**File**: `/libs/zephyr-agent/src/lib/engine/logging/logger.ts`

- Extract logging code
- Create consistent logging interface
- Implement configurable log levels
- Create comprehensive unit tests

## Phase 6: Interface Definitions

### Step 1: Plugin Interface Definition

**File**: `/libs/zephyr-agent/src/lib/engine/interfaces/bundler-plugin.ts`

- Define common plugin interface
- Create build context interfaces
- Document plugin lifecycle
- Provide example implementations

### Step 2: Type Definitions

**File**: `/libs/zephyr-agent/src/lib/engine/types.ts`

- Define common types used across abstractions
- Create enums for common values
- Ensure proper exports
- Document all types

## Phase 7: Integration Testing

### Step 1: Create Integration Tests

**File**: `/libs/zephyr-agent/src/lib/engine/tests/integration.test.ts`

- Create tests that use multiple abstractions together
- Verify proper interoperation
- Test with real-world examples
- Document integration patterns

### Step 2: Documentation

**File**: `/libs/zephyr-agent/src/lib/engine/README.md`

- Document the entire abstraction layer
- Provide examples for each component
- Document best practices
- Create API reference

## Phase 8: Bundler Adaptation Implementation

### Step 1: xpack Adaptation

**File**: `/libs/zephyr-xpack-internal/src/lib/adapters/engine-adapter.ts`

- Create adapter for xpack to use engine abstractions
- Ensure proper integration with webpack/rspack
- Maintain backward compatibility
- Create comprehensive unit tests

### Step 2: rollx Adaptation

**File**: `/libs/zephyr-rollx-internal/src/lib/adapters/engine-adapter.ts`

- Create adapter for rollx to use engine abstractions
- Ensure proper integration with rollup/vite
- Maintain backward compatibility
- Create comprehensive unit tests

## Phase 9: Plugin Migration

### Step 1: Migrate Webpack Plugin

**Files**: 
- `/libs/zephyr-webpack-plugin/src/webpack-plugin/basehref-webpack-plugin.ts`
- `/libs/zephyr-webpack-plugin/src/webpack-plugin/remote-types-webpack-plugin.ts`

- Refactor to use engine abstractions
- Ensure all duplicated code is removed
- Maintain backward compatibility
- Update tests

### Step 2: Migrate Vite Plugin

**Files**:
- `/libs/vite-plugin-zephyr/src/lib/basehref-vite-plugin.ts`
- `/libs/vite-plugin-zephyr/src/lib/remote-types-vite-plugin.ts`

- Refactor to use engine abstractions
- Ensure all duplicated code is removed
- Maintain backward compatibility
- Update tests

### Step 3: Migrate Rspack Plugin

**Files**:
- `/libs/zephyr-rspack-plugin/src/rspack-plugin/basehref-rspack-plugin.ts`
- `/libs/zephyr-rspack-plugin/src/rspack-plugin/remote-types-rspack-plugin.ts`

- Refactor to use engine abstractions
- Ensure all duplicated code is removed
- Maintain backward compatibility
- Update tests

### Step 4: Create RollX Implementations

**Files**:
- `/libs/zephyr-rollx-internal/src/lib/plugins/basehref-rollx-plugin.ts`
- `/libs/zephyr-rollx-internal/src/lib/plugins/remote-types-rollx-plugin.ts`

- Create rollx implementations using engine abstractions
- Ensure clean integration with rollup/vite
- Create comprehensive unit tests
- Document implementation approach

## Phase 10: Verification and Final Documentation

### Step 1: End-to-End Testing

- Create end-to-end tests for each bundler type
- Verify functionality matches original implementation
- Ensure backward compatibility
- Document test results

### Step 2: Final Documentation

- Update all READMEs with new architecture
- Create architecture diagrams
- Document integration patterns
- Provide migration guide for plugin developers

## Implementation Schedule

| Phase | Estimated Time | Dependencies |
|-------|---------------|--------------|
| Phase 1 | 1 day | None |
| Phase 2 | 1 day | Phase 1 |
| Phase 3 | 1 day | Phase 1, Phase 2 |
| Phase 4 | 1 day | Phase 1 |
| Phase 5 | 1 day | Phase 1 |
| Phase 6 | 0.5 day | Phases 1-5 |
| Phase 7 | 1 day | Phases 1-6 |
| Phase 8 | 1 day | Phases 1-7 |
| Phase 9 | 2 days | Phases 1-8 |
| Phase 10 | 1 day | Phases 1-9 |

Total estimated time: **10.5 days**

## Success Criteria

1. **Duplication Reduction**: Measure code duplication before and after implementation
2. **Test Coverage**: Ensure >90% test coverage for all abstractions
3. **Documentation**: Complete API documentation with examples
4. **Integration Verification**: All existing functionality works with abstracted code
5. **Performance**: No regression in performance metrics
6. **Size**: Bundle size reduction or no significant increase
7. **Developer Experience**: Improved developer experience for plugin authors