# Phase 5: Enhanced Configuration Support - Implementation Plan

This document outlines the detailed implementation plan for Phase 5 of the Zephyr packages enhancement, focusing on improved configuration support.

## Overview

Phase 5 aims to enhance the configuration capabilities of Zephyr packages, particularly focusing on three key areas:

1. BaseHref implementation for proper path resolution
2. Remote types detection (CSR/SSR) 
3. Remote entry structure sharing

These enhancements will improve the developer experience, reduce configuration errors, and enable better integration between remotes.

## 5.1 BaseHref Implementation

### Background

Many applications are deployed to non-root paths in production environments. This requires proper configuration of base paths for static assets, API calls, and module federation remotes. Currently, different bundlers handle this differently:

- Vite uses the `base` configuration option
- Webpack/Rspack use `publicPath` (or `output.publicPath`)

Implementing consistent BaseHref support will ensure that applications work correctly regardless of their deployment path.

### Implementation Plan

#### 1. Research & Analysis

- **Review Current Implementations**
  - Analyze how paths are handled in Vite, Webpack, and Rspack
  - Document the current limitations and edge cases
  - Review Module Federation's handling of URLs

- **Define Requirements**
  - Support for absolute paths (`/assets/`)
  - Support for relative paths (`./assets/`)
  - Support for fully qualified URLs (`https://cdn.example.com/assets/`)
  - Support for dynamic runtime determination

#### 2. Vite Integration

- **Configuration Processing**
  - Add support for Vite's `base` option
  - Process relative and absolute paths correctly
  - Create validation for path formatting

- **Runtime Adjustments**
  - Implement runtime path detection when needed
  - Add support for dynamically determined base paths
  - Create utilities for path normalization

#### 3. Webpack/Rspack Integration

- **PublicPath Configuration**
  - Add support for `output.publicPath` configuration
  - Support various formats (absolute, relative, URL)
  - Handle undefined or empty paths appropriately

- **HTML Plugin Integration**
  - Coordinate with html-webpack-plugin for consistent paths
  - Ensure generated HTML uses correct base paths
  - Support runtime determination when needed

#### 4. Manifest Integration

- **Enhanced Manifest Format**
  - Add `baseHref` field to manifest
  - Include original configuration value
  - Add normalized value for consistency

- **URL Construction**
  - Create utilities for constructing URLs with baseHref
  - Handle various combinations of paths
  - Add validation for resulting URLs

#### 5. Testing Strategy

- **Test Fixtures**
  - Create test applications with various base path configurations
  - Include edge cases (empty path, trailing slashes, etc.)
  - Create tests for different deployment scenarios

- **Validation Tests**
  - Test path resolution in different environments
  - Verify correct URL construction
  - Test integration with Module Federation

#### 6. Documentation

- **Usage Guidelines**
  - Document configuration options for different bundlers
  - Provide examples for common scenarios
  - Include troubleshooting information

- **Best Practices**
  - Recommend approaches for different deployment scenarios
  - Document considerations for path changes
  - Include security considerations

### Deliverables

1. BaseHref implementation for Vite
2. BaseHref implementation for Webpack/Rspack
3. Path utilities and normalization functions
4. Test suite for path resolution
5. Enhanced manifest with baseHref support
6. Comprehensive documentation

## 5.2 Remote Types Detection

### Background

Applications can be either Client-Side Rendered (CSR) or Server-Side Rendered (SSR). When remotes of different types are composed, specific handling is required. Automatically detecting and handling these differences improves developer experience and reduces configuration errors.

### Implementation Plan

#### 1. Analysis of Rendering Patterns

- **Document Differences**
  - Analyze CSR vs SSR execution patterns
  - Identify reliable detection signals
  - Document edge cases and special considerations

- **Detection Heuristics**
  - Define reliable indicators for CSR/SSR
  - Identify configuration clues
  - Determine fallback strategies

#### 2. Detection Implementation

- **Automatic Detection**
  - Create heuristics for build-time detection
  - Implement configuration analysis
  - Add detection based on dependencies and imports

- **Runtime Verification**
  - Add runtime checks for environment capabilities
  - Implement detection for server vs client context
  - Create warning system for mismatches

#### 3. Configuration Options

- **Manual Specification**
  - Add explicit configuration for render type
  - Create validation for configuration values
  - Implement override system for detection

- **Framework-Specific Options**
  - Add specialized options for different frameworks
  - Support Next.js, Remix, and other SSR frameworks
  - Add compatibility with different rendering strategies

#### 4. Type Metadata

- **Enhanced Manifest**
  - Add renderType field to manifest
  - Include detection confidence level
  - Add framework-specific information

- **Consumption System**
  - Create utilities for reading type information
  - Implement handling for mixed CSR/SSR environments
  - Add compatibility checking

#### 5. Testing Strategy

- **Mixed Environment Tests**
  - Create test fixtures with mixed CSR/SSR
  - Test detection accuracy across frameworks
  - Validate behavior with different configurations

- **Edge Case Testing**
  - Test universal applications (both CSR and SSR)
  - Test with partial SSR implementations
  - Validate behavior with hybrid approaches

#### 6. Documentation

- **Usage Guidelines**
  - Document automatic detection capabilities
  - Provide examples for explicit configuration
  - Include framework-specific considerations

- **Troubleshooting**
  - Document common issues and solutions
  - Provide guidance for mixed environments
  - Include performance considerations

### Deliverables

1. CSR/SSR detection implementation
2. Configuration options for manual specification
3. Enhanced manifest with render type information
4. Consumption utilities for type information
5. Test suite for detection accuracy
6. Comprehensive documentation

## 5.3 Remote Entry Structure Sharing

### Background

Sharing information about the structure of remote entries enables better integration, error handling, and compatibility checking. This includes details about the Module Federation version, framework, and dependencies.

### Implementation Plan

#### 1. Metadata Enhancement

- **Define Metadata Structure**
  - Create schema for remote structure information
  - Define required and optional fields
  - Include versioning for evolution

- **Collect Information**
  - Extract Module Federation version
  - Detect framework and version
  - Identify key dependencies and versions

#### 2. Manifest Extensions

- **Enhanced Manifest Format**
  - Add structure fields to manifest
  - Include version and compatibility information
  - Add framework-specific details

- **Serialization & Validation**
  - Implement serialization for structure data
  - Add validation for required fields
  - Create schema version handling

#### 3. Sharing Mechanism

- **Publishing API**
  - Create API for publishing metadata
  - Implement storage strategy
  - Add versioning support

- **Retrieval API**
  - Implement metadata retrieval
  - Add caching for performance
  - Create fallback for missing data

#### 4. Consumer Integration

- **Consumption Utilities**
  - Create utilities for reading structure data
  - Implement compatibility checking
  - Add version negotiation

- **Adaptive Behavior**
  - Implement behavior changes based on structure
  - Add framework-specific optimizations
  - Create fallbacks for limited information

#### 5. Testing Strategy

- **Compatibility Testing**
  - Test with different Module Federation versions
  - Validate behavior with different frameworks
  - Test with missing or incomplete data

- **Performance Testing**
  - Measure impact of metadata sharing
  - Test caching effectiveness
  - Validate network overhead

#### 6. Documentation

- **Integration Guide**
  - Document metadata schema
  - Provide examples for publishing and consuming
  - Include best practices

- **Compatibility Matrix**
  - Create compatibility documentation
  - Document support across frameworks
  - Include version compatibility information

### Deliverables

1. Enhanced metadata schema
2. Manifest extensions for structure data
3. Publishing and retrieval APIs
4. Consumption utilities and compatibility checking
5. Test suite for structure sharing
6. Comprehensive documentation

## Implementation Timeline

| Task | Duration | Dependencies |
|------|----------|--------------|
| 5.1.1 Research & Analysis | 3 days | None |
| 5.1.2 Vite Integration | 4 days | 5.1.1 |
| 5.1.3 Webpack/Rspack Integration | 4 days | 5.1.1 |
| 5.1.4 Manifest Integration | 2 days | 5.1.2, 5.1.3 |
| 5.1.5 Testing Strategy | 3 days | 5.1.4 |
| 5.1.6 Documentation | 2 days | 5.1.5 |
| **5.1 BaseHref Implementation** | **2 weeks** | |
| 5.2.1 Analysis of Rendering Patterns | 3 days | None |
| 5.2.2 Detection Implementation | 5 days | 5.2.1 |
| 5.2.3 Configuration Options | 3 days | 5.2.2 |
| 5.2.4 Type Metadata | 2 days | 5.2.3 |
| 5.2.5 Testing Strategy | 3 days | 5.2.4 |
| 5.2.6 Documentation | 2 days | 5.2.5 |
| **5.2 Remote Types Detection** | **2 weeks** | |
| 5.3.1 Metadata Enhancement | 3 days | None |
| 5.3.2 Manifest Extensions | 3 days | 5.3.1 |
| 5.3.3 Sharing Mechanism | 4 days | 5.3.2 |
| 5.3.4 Consumer Integration | 3 days | 5.3.3 |
| 5.3.5 Testing Strategy | 3 days | 5.3.4 |
| 5.3.6 Documentation | 2 days | 5.3.5 |
| **5.3 Remote Entry Structure Sharing** | **2 weeks** | |

## Testing Requirements

For Phase 5, we'll continue with our TDD approach, ensuring comprehensive test coverage:

1. **Unit Tests**
   - Test individual components and functions
   - Ensure proper error handling
   - Validate edge cases

2. **Integration Tests**
   - Test interactions between components
   - Validate end-to-end workflows
   - Test with real application configurations

3. **Cross-Framework Tests**
   - Test with different JavaScript frameworks
   - Validate behavior with different bundlers
   - Test with various deployment scenarios

4. **Performance Tests**
   - Measure impact on build time
   - Evaluate runtime performance
   - Test with large applications

## Documentation Plan

Documentation for Phase 5 will include:

1. **Feature Documentation**
   - Detailed explanation of new features
   - Configuration options and examples
   - Best practices and recommendations

2. **API Reference**
   - Complete API documentation
   - Types and interfaces
   - Method signatures and examples

3. **Integration Guides**
   - Step-by-step guides for integration
   - Framework-specific considerations
   - Troubleshooting information

4. **Migration Guide**
   - Instructions for updating from previous versions
   - Breaking changes and deprecations
   - Compatibility considerations

## Success Criteria

Phase 5 will be considered successful when:

1. BaseHref implementation works correctly across different bundlers
2. Remote types detection accurately identifies CSR/SSR applications
3. Remote entry structure sharing enables improved integration
4. All features have 85%+ test coverage
5. Documentation is comprehensive and clear
6. Performance impact is minimal or justified by benefits

## Risk Management

Potential risks for Phase 5 include:

1. **Cross-Framework Compatibility**
   - Different frameworks handle paths and SSR differently
   - Mitigation: Extensive testing with multiple frameworks

2. **Detection Accuracy**
   - SSR detection may have false positives/negatives
   - Mitigation: Provide explicit configuration options

3. **Performance Impact**
   - Additional metadata may affect performance
   - Mitigation: Implement caching and optimize serialization

4. **Breaking Changes**
   - New features may require configuration changes
   - Mitigation: Design for backward compatibility, provide migration guides

## Conclusion

Phase 5 will significantly enhance the configuration capabilities of Zephyr packages, improving developer experience and enabling more advanced integration scenarios. The implementation will follow our established TDD approach, ensuring high quality and comprehensive test coverage.