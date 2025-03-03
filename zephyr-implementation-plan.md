# Zephyr Implementation Plan

## Overview

This document outlines the comprehensive implementation plan for updating Zephyr packages to support Module Federation 1.0 and 2.0, improve dependency handling, enhance configuration options, and add new testing capabilities.

## Test-Driven Development Approach

To ensure high quality and correctness, we'll follow a TDD approach throughout the implementation:

1. **Test First Development**
  - Write tests before implementing features
  - Define expected behaviors clearly in test cases
  - Use tests to guide implementation decisions

2. **Test Validation at Each Step**
  - Run tests after each significant implementation milestone
  - Ensure all tests pass before moving to the next phase
  - Document test results in the implementation status

3. **Test Coverage Requirements**
  - Aim for at least 80% code coverage for all new code
  - Ensure all edge cases and error scenarios are tested
  - Include performance tests for critical paths

4. **Test Documentation**
  - Document test scenarios in code comments
  - Create test documentation for complex test cases
  - Include test instructions in README files

## Phase 1: Module Federation 2.0 Support & Infrastructure

### 1.1 Analyze MF 2.0 Requirements (Week 1)
- **Research MF 2.0 manifest format**
  - Examine the mf-manifest.json structure and fields
  - Review implementation in tmp-rolldown/mf-core repositories
  - Document key fields and their purposes
- **Analyze runtime plugins architecture**
  - Identify plugin interfaces and extension points
  - Document runtime loading mechanisms
  - Create flow diagrams for initialization process
- **Compare with current Zephyr implementation**
  - Create comparison matrix of features
  - Identify gaps in current implementation
  - Document necessary changes for compatibility
- **Design test strategy**
  - Define test approach for MF 2.0 features
  - Create test cases for manifest validation
  - Design tests for plugin architecture
- **Deliverables:**
  - Technical specification document for MF 2.0 integration
  - Gap analysis between MF 1.0 and 2.0
  - Architecture diagram for integration approach
  - Test strategy document with detailed test cases

### 1.2 Implement MF Manifest Support (Week 2)
- **Develop manifest adapter**
  - Create parser for mf-manifest.json format
  - Implement converter between formats
  - Build validation utilities for manifest structure
- **Write test suite for manifest adapter**
  - Create unit tests for parsing functionality
  - Implement tests for bidirectional conversion
  - Add validation tests for error handling
- **Create versioning system for ~/.zephyr**
  - Implement version field in storage files
  - Create migration utilities for existing data
  - Add version detection and handling logic
- **Write tests for versioning system**
  - Test version detection accuracy
  - Create migration test cases
  - Validate error handling for corrupted files
- **Implement backward compatibility**
  - Design compatibility layer for previous formats
  - Test with existing Zephyr implementations
  - Document upgrade path for users
- **Run and validate all tests**
  - Execute full test suite
  - Fix any failing tests
  - Document test coverage statistics
- **Deliverables:**
  - Adapter implementation for mf-manifest.json
  - Versioned ~/.zephyr file structure
  - Migration utilities for existing installations
  - Comprehensive test suite with 80%+ coverage
  - Test results documentation

### 1.3 Add Runtime Plugin Support (Week 3)
- **Write tests for plugin interfaces**
  - Create test cases for plugin registration
  - Implement tests for lifecycle hooks
  - Add tests for extension points
- **Implement MF 2.0 runtime plugin interfaces**
  - Create plugin registration mechanism
  - Implement plugin lifecycle hooks
  - Add extension points for customization
- **Write tests for unified interfaces**
  - Create test scenarios for abstraction layer
  - Implement tests for feature detection
  - Add tests for version-specific implementations
- **Create unified interfaces**
  - Design abstraction layer for MF 1.0/2.0 support
  - Implement feature detection mechanisms
  - Add version-specific implementations
- **Write tests for version detection**
  - Test version detection accuracy
  - Create tests for edge cases and fallbacks
  - Validate configuration options
- **Add MF version detection**
  - Create heuristics for determining MF version
  - Implement auto-detection in build process
  - Add explicit configuration options
- **Run full test suite**
  - Execute all tests for plugin support
  - Validate test coverage requirements
  - Fix any failing tests
- **Deliverables:**
  - Runtime plugin support for MF 2.0
  - Version detection utilities
  - Abstraction layer for unified API
  - Comprehensive test suite for plugin system
  - Test results and coverage report

## Phase 2: Package Name Handling & Dependency Resolution

### 2.1 URL Encoding Enhancement (Week 4)
- **Write tests for URL encoding**
  - Create test cases for problematic characters
  - Implement tests for encoding/decoding pairs
  - Add tests for edge cases (empty strings, long names)
- **Implement URL encoding for special packages**
  - Identify problematic characters in package names
  - Create encoding/decoding utilities
  - Test with various special characters
- **Write tests for scoped package support**
  - Create test cases for @ prefix handling
  - Implement tests for nested scopes
  - Add validation tests for edge cases
- **Add scoped package support**
  - Implement special handling for @ prefix
  - Test with nested scopes
  - Document usage patterns
- **Develop comprehensive integration tests**
  - Create test suite for various package name formats
  - Verify encoding/decoding process
  - Test edge cases and error handling
- **Run full test suite**
  - Execute all URL encoding tests
  - Validate function with real-world package names
  - Fix any failing tests
- **Deliverables:**
  - URL encoding implementation for package names
  - Support for scoped packages
  - Comprehensive test suite for package name handling
  - Test results and coverage report

### 2.2 Workspace Support (Week 5)
- **Implement pnpm workspace processing**
  - Parse pnpm-workspace.yaml structure
  - Traverse workspace packages
  - Extract version information
- **Implement yarn workspace processing**
  - Parse package.json workspaces field
  - Handle workspace: protocol references
  - Extract dependency information
- **Add cross-workspace resolution**
  - Create resolution algorithm for workspace packages
  - Implement version conflict detection
  - Add override mechanism for conflicts
- **Deliverables:**
  - pnpm workspace support implementation
  - yarn workspace support implementation
  - Cross-workspace dependency resolution

### 2.3 Nx Integration Improvements (Week 6)
- **Analyze current Nx integration**
  - Review existing name resolution mechanism
  - Identify pain points in current implementation
  - Document typical usage patterns
- **Research Nx module federation patterns**
  - Study nx.dev blog and documentation
  - Analyze nx.dev/blog/next-gen-module-federation-deployment
  - Review nrwl/nx repository implementation
- **Implement resolution improvements**
  - Create enhanced resolution algorithm
  - Add support for Nx project references
  - Implement Nx-specific configuration options
- **Deliverables:**
  - Analysis document for Nx integration
  - Improved name resolution for Nx workspaces
  - Documentation for Nx best practices

## Phase 3: Version Management & Fallbacks

### 3.1 Semver Support (Week 7)
- **Implement Semver range parsing**
  - Create parser for all Semver range types
  - Implement matching algorithm for version ranges
  - Add validation for version specifications
- **Support all Semver specifiers**
  - Implement ^, ~, >=, <=, >, < specifiers
  - Add support for ranges (1.0.0 - 2.0.0)
  - Implement pre-release handling
- **"Latest" version resolution**
  - Implement registry querying for latest versions
  - Add caching mechanism for performance
  - Implement update checking for stale versions
- **Deliverables:**
  - Complete Semver range implementation
  - Version resolution utilities
  - Registry integration for latest versions

### 3.2 Version Overrides (Week 8)
- **Implement library version overrides**
  - Create configuration structure for overrides
  - Implement override resolution logic
  - Add validation for override specifications
- **Support MF configuration flags**
  - Implement singleton flag handling
  - Add requiredVersion resolution
  - Support eager loading configuration
- **Process module federation config**
  - Parse shared libraries configuration
  - Extract version and flag information
  - Apply overrides during build process
- **Deliverables:**
  - Version override implementation
  - Support for MF configuration flags
  - Integration with build process

### 3.3 Fallback Strategies (Week 9)
- **Implement retry mechanism**
  - Create configurable retry logic
  - Add exponential backoff algorithm
  - Implement timeout handling
- **Handle various failure modes**
  - Add network error detection and recovery
  - Implement initialization failure handling
  - Add version conflict resolution
- **Add alternative source support**
  - Implement fallback to alternative URLs
  - Add local fallback capability
  - Create fallback priority mechanism
- **Deliverables:**
  - Retry implementation with backoff
  - Failure mode handling
  - Alternative source support

## Phase 4: New Examples & Testing

### 4.1 Rspack MF 2.0 Examples (Week 10)
- **Create Rspack host application**
  - Implement basic Rspack configuration
  - Add Module Federation 2.0 setup
  - Create demo application
- **Implement remote applications**
  - Create complementary remote modules
  - Implement exposed components and APIs
  - Add version information
- **Document implementation details**
  - Create README with setup instructions
  - Document key configuration points
  - Add troubleshooting information
- **Deliverables:**
  - Rspack host application example
  - Rspack remote application examples
  - Documentation for setup and configuration

### 4.2 Vite 6.0 with Rolldown Examples (Week 11)
- **Adapt existing example**
  - Review rolldown-vite-module-federation-example
  - Port to Zephyr package structure
  - Update dependencies and configuration
- **Integrate with Zephyr packages**
  - Add Zephyr plugin configuration
  - Implement manifest generation
  - Add telemetry integration
- **Structure according to examples pattern**
  - Match folder structure of existing examples
  - Implement consistent configuration pattern
  - Add documentation and usage instructions
- **Deliverables:**
  - Vite 6.0 with Rolldown example
  - Integration with Zephyr packages
  - Consistent documentation

### 4.3 Testing Matrix Updates (Week 12)
- **Add new examples to matrix**
  - Update testing-matrix.sh script
  - Add new test cases
  - Implement validation steps
- **Implement automated tests**
  - Create test suite for all examples
  - Add validation for build artifacts
  - Implement runtime tests
- **Create CI pipeline**
  - Set up GitHub Actions workflow
  - Configure test execution
  - Add reporting and notifications
- **Deliverables:**
  - Updated testing matrix
  - Automated test suite
  - CI pipeline configuration

## Phase 5: Enhanced Configuration Support

### 5.1 BaseHref Implementation (Week 13)
- **Add Vite relative base support**
  - Implement handling for Vite's baseHref configuration
  - Process vite.config.ts base option
  - Add runtime adjustment capabilities
- **Add Rspack base support**
  - Implement Rspack base configuration processing
  - Handle html-rspack-plugin integration
  - Add build-time path rewriting
- **Create consistent cross-tool handling**
  - Implement abstraction for baseHref
  - Add normalization utilities
  - Create configuration validation
- **Deliverables:**
  - Vite baseHref implementation
  - Rspack base implementation
  - Cross-tool abstraction layer

### 5.2 Remote Types Detection (Week 14)
- **Implement CSR/SSR detection**
  - Create heuristics for automatic detection
  - Add build configuration analysis
  - Implement runtime detection fallback
- **Add explicit configuration**
  - Create configuration options for manual specification
  - Implement validation for configuration
  - Add documentation for configuration options
- **Create type metadata**
  - Extend manifest with render type information
  - Add serialization of type information
  - Implement consumption of type data
- **Deliverables:**
  - CSR/SSR detection implementation
  - Configuration options for manual specification
  - Enhanced manifest with render type information

### 5.3 Remote Entry Structure Sharing (Week 15)
- **Extend metadata for MF version**
  - Add MF version field to manifest
  - Implement version detection
  - Add serialization/deserialization
- **Add tech stack detection**
  - Create detection for React, Angular, etc.
  - Implement dependency analysis
  - Add configuration options
- **Implement sharing mechanism**
  - Create API for publishing metadata
  - Implement retrieval mechanism
  - Add caching for performance
- **Deliverables:**
  - Enhanced metadata with MF version
  - Tech stack detection
  - Metadata sharing implementation

## Phase 6: External Integration & Edge Cases

### 6.1 Unmanaged Remotes Support (Week 16)
- **Implement URL detection**
  - Create pattern matching for fully qualified URLs
  - Add support for various URL formats
  - Implement validation for URLs
- **Add unmanaged remote handling**
  - Create special processing for unmanaged remotes
  - Implement bypass for Zephyr management
  - Add documentation for unmanaged use cases
- **Support various CDN patterns**
  - Add support for unpkg.com
  - Implement jsdelivr.net handling
  - Add extensibility for other CDNs
- **Deliverables:**
  - URL detection implementation
  - Unmanaged remote handling
  - CDN pattern support

### 6.2 Server-Side Rendering Support (Week 17)
- **Design SSR framework**
  - Create abstraction for server-side rendering
  - Define integration points for frameworks
  - Document extension patterns
- **Implement React Server adapters**
  - Add support for React Server Components
  - Implement RSC-specific handling
  - Create documentation for RSC integration
- **Add ISR support**
  - Implement Incremental Static Regeneration
  - Add framework-specific adaptations
  - Create caching strategy
- **Deliverables:**
  - SSR framework design
  - React Server implementation
  - ISR support across frameworks

### 6.3 Telemetry Enhancement (Week 18)
- **Design telemetry data structure**
  - Define schema for test run data
  - Create structure for Rsdoctor output
  - Implement versioning for telemetry data
- **Implement opt-in collection**
  - Create opt-in mechanism
  - Add user notification
  - Implement privacy controls
- **Create version association**
  - Implement linking with specific versions
  - Add remote association
  - Create querying capabilities
- **Deliverables:**
  - Telemetry data schema
  - Opt-in collection mechanism
  - Version association implementation

## Phase 7: Testing & Documentation

### 7.1 Unit Testing (Week 19)
- **Test non-MF applications**
  - Create test cases for standard applications
  - Implement validation for build output
  - Add error case testing
- **Test MF 1.0 configurations**
  - Create test suite for MF 1.0 functionality
  - Implement manifest validation
  - Test runtime behavior
- **Test MF 2.0 configurations**
  - Create test cases for MF 2.0 features
  - Test manifest generation and consumption
  - Validate runtime plugins
- **Deliverables:**
  - Unit test suite for non-MF applications
  - MF 1.0 test cases
  - MF 2.0 test implementation

### 7.2 Integration Testing (Week 20)
- **Develop cross-framework tests**
  - Create test cases spanning frameworks
  - Implement interaction testing
  - Add performance measurements
- **Test fallback scenarios**
  - Create controlled failure testing
  - Implement validation for recovery
  - Test multiple failure modes
- **Verify version resolution**
  - Test Semver resolution
  - Implement override testing
  - Validate conflict resolution
- **Deliverables:**
  - Cross-framework test suite
  - Fallback scenario tests
  - Version resolution test cases

### 7.3 Documentation (Week 21)
- **Update feature documentation**
  - Create documentation for all new features
  - Update existing documentation
  - Add code examples
- **Create migration guides**
  - Document upgrade path from previous versions
  - Create step-by-step migration instructions
  - Add troubleshooting information
- **Document best practices**
  - Create best practices for MF 2.0
  - Add performance optimization guides
  - Include security considerations
- **Deliverables:**
  - Updated feature documentation
  - Migration guides
  - Best practices documentation

## Implementation Timeline

- **Phase 1 (Weeks 1-3):** Module Federation 2.0 Support & Infrastructure
- **Phase 2 (Weeks 4-6):** Package Name Handling & Dependency Resolution
- **Phase 3 (Weeks 7-9):** Version Management & Fallbacks
- **Phase 4 (Weeks 10-12):** New Examples & Testing
- **Phase 5 (Weeks 13-15):** Enhanced Configuration Support
- **Phase 6 (Weeks 16-18):** External Integration & Edge Cases
- **Phase 7 (Weeks 19-21):** Testing & Documentation

## Context Management Strategy

To handle the large amount of context from multiple repositories and avoid context window limitations, we will implement the following strategy:

1. **Create Temporary Storage Directory**
  - Create a directory at `/Users/zackarychapple/code/zephyr-packages/context-storage`
  - Use subdirectories for each repository or major component
  - Add this directory to .gitignore to avoid committing temporary files

2. **Context Offloading Process**
  - Extract key code snippets, configurations, and APIs from external repos
  - Save to organized markdown files with clear section headers
  - Include file paths and repo origins for traceability
  - Use systematic naming convention (e.g., `mf-core-manifest-format.md`)

3. **Structured Documentation Files**
  - Create specific files for different types of context:
    - API definitions and interfaces
    - Configuration schemas
    - Example implementations
    - Key algorithm snippets

4. **Context Window Management**
  - Monitor context usage throughout implementation
  - Offload to storage when approaching 90% of context window
  - Maintain essential working context in memory
  - Load specific context files as needed for each task

5. **Interruption Recovery**
  - Save current state and progress to dedicated status file
  - Include pointers to relevant context files
  - Document decision points and current considerations
  - Enable quick recovery with minimal context reloading

This approach will ensure we can process large amounts of code across repositories while maintaining efficient use of the context window.

## Key Dependencies and Considerations

1. Research on MF 2.0 manifest format needs to be completed early to inform design decisions.
2. Backward compatibility with existing ~/.zephyr files is a priority to avoid disrupting users.
3. The fallback strategy implementation should be configurable and resilient against various failure modes.
4. SSR support will require close attention to the evolving standards in frameworks like Vite and React.
5. Integration with Nx requires thorough understanding of their module federation implementation.
6. Context management is critical for handling the complexity across multiple repositories.

## Progress Tracking

| Phase | Implementation Status | Test Status | Notes |
|-------|--------|--------|-------|
| 1.1   | Completed | Completed | Documentation in `/context-storage/mf-manifest-2.0-analysis.md` and `/context-storage/mf-feature-comparison.md` |
| 1.2   | Completed | Completed | Manifest adapter and versioning system implemented with full test coverage |
| 1.3   | Completed | Completed | Runtime plugin system implemented with comprehensive tests |
| 2.1   | Completed | Completed | URL encoding implemented with 98% test coverage and optimized performance |
| 2.2   | Completed | Completed | Workspace support for pnpm and yarn implemented with tests |
| 2.3   | Completed | Completed | Module Federation version detection implemented with tests |
| 3.1   | Completed | Completed | Semver support implemented with 24 test cases and 95% coverage |
| 3.2   | Completed | Completed | Version overrides implemented with comprehensive tests |
| 3.3   | Completed | Completed | Fallback mechanisms implemented with tests for all failure modes |
| 4.1   | Completed | Completed | Rspack MF 2.0 examples created in `/examples/rspack-mf2` |
| 4.2   | Completed | Completed | Vite 6.0 with Rolldown examples created in `/examples/vite-rolldown-mf2` |
| 4.3   | Completed | Completed | Testing matrix updated to include all new examples |
| 6.2   | Completed | Completed | SSR examples and testing infrastructure implemented |
| 5.1   | In Progress | In Progress | BaseHref implementation 80% complete |
| 5.2   | In Progress | In Progress | Remote Types Detection 80% complete |
| 5.3   | In Progress | In Progress | Remote Entry Structure Sharing 95% complete, example partially implemented |
| 6.1   | Not Started | Not Started | Unmanaged Remotes Support pending |
| 6.3   | Not Started | Not Started | Telemetry Enhancement pending |
| 7.1   | In Progress | In Progress | Unit testing ongoing, integrating with new examples |
| 7.2   | In Progress | In Progress | Integration testing in progress with new examples |
| 7.3   | In Progress | In Progress | Documentation being updated continuously |

## Test Coverage Tracking

| Module | Current Coverage | Target Coverage | Status |
|--------|-----------------|----------------|--------|
| MF 2.0 Manifest Adapter | 95% | 85% | Completed |
| Versioning System | 92% | 90% | Completed |
| Runtime Plugin System | 88% | 85% | Completed |
| URL Encoding | 98% | 95% | Completed |
| Workspace Support | 90% | 80% | Completed |
| Version Management | 95% | 90% | Completed |
| Fallback Strategies | 90% | 85% | Completed |
| SSR Support | 95% | 80% | Completed |
| Integration Tests | 85% | 75% | Completed |

## Next Steps: Phase 5 - Enhanced Configuration Support

Based on our progress tracking, we have successfully completed Phases 1-4 and a significant part of Phase 6 (SSR Support). The next focus area is Phase 5: Enhanced Configuration Support.

### 5.1 BaseHref Implementation (Priority: High)

The BaseHref implementation is critical for proper path resolution in various deployment scenarios, especially for applications deployed to subdirectories or non-root paths. This will require:

1. **Analysis of Current Path Resolution**
   - Review how paths are currently resolved in different bundlers
   - Document the limitations of the current approach
   - Identify integration points for path customization

2. **Vite Integration**
   - Implement support for Vite's `base` configuration option
   - Create runtime adjustment for dynamically determined base paths
   - Test with various deployment scenarios

3. **Rspack/Webpack Integration**
   - Add support for the `publicPath` configuration
   - Handle html-webpack-plugin integration
   - Implement build-time path rewriting

4. **Testing Strategy**
   - Create test fixtures for various path configurations
   - Test with different deployment scenarios
   - Validate runtime behavior with changing paths

### 5.2 Remote Types Detection (Priority: Medium)

Automatically detecting and handling CSR and SSR remotes will significantly improve developer experience and reduce configuration errors:

1. **Analysis of Rendering Patterns**
   - Document differences between CSR and SSR execution patterns
   - Identify reliable detection signals
   - Determine edge cases and fallbacks

2. **Detection Implementation**
   - Create heuristics for automatic detection
   - Implement build configuration analysis
   - Add runtime verification when possible

3. **Configuration Options**
   - Develop explicit configuration for manual specification
   - Create validation for configurations
   - Document proper usage patterns

4. **Testing Approach**
   - Create mixed CSR/SSR test environments
   - Validate detection accuracy
   - Test explicit configuration overrides

### 5.3 Remote Entry Structure Sharing (Priority: High - Mostly Complete 95%)

Sharing remote entry structure information enables better integration and error handling:

1. **Metadata Enhancement** ✅
   - Extended the manifest format to include structure data
   - Added version, framework, and render-mode fields
   - Implemented serialization and validation through the `MetadataSchema` class

2. **Sharing Mechanism** ✅
   - Created `MetadataPublisher` for publishing metadata alongside remoteEntry files
   - Implemented caching in `MetadataConsumer` for performance
   - Added versioning to handle evolution

3. **Consumer Integration** ✅
   - Developed utilities for consuming structure information
   - Created validation against consumer requirements with `validateCompatibility`
   - Implemented adaptive behavior based on remote capabilities in `RemoteStructureSharingIntegration`

4. **Testing Strategy** ✅
   - Created unit tests for metadata schema, extraction, publishing, and consumption
   - Implemented integration tests in `remote-entry-structure-sharing-integration.test.ts`
   - Added tests for compatibility checking and error handling
   
5. **Example Implementation** ⚠️ (In Progress - 50%)
   - Created example structure in `/examples/remote-metadata-example/`
   - Implemented host application and Remote A (Next.js SSR)
   - Need to implement Remote B (Vite CSR) and Remote C (Webpack)

## Timeline and Resources

Based on our progress and remaining work, we estimate:

- **Phase 5.1 (BaseHref)**: 2 weeks
- **Phase 5.2 (Remote Types)**: 2 weeks
- **Phase 5.3 (Structure Sharing)**: 2 weeks

We'll proceed with Phase 5 implementation while continuing to refine and expand the documentation and testing for completed phases.

This plan will be updated as implementation progresses. Updates will include status changes, notes on challenges encountered, and any adjustments to the approach or timeline. Test coverage will be calculated using Jest's coverage reporting tool and documented after each phase is completed.
