# Phase 3.1: Framework-Specific Examples

This document outlines the plan for implementing framework-specific examples with Module Federation 2.0 integration.

## Goals

1. Create example applications demonstrating Zephyr integration with:
   - Rspack using Module Federation 2.0
   - Vite 6.0 with Rolldown using Module Federation 2.0
2. Add both examples to the test matrix
3. Document the integration process for each framework

## Implementation Steps

### 1. Rspack Example with MF 2.0

#### Setup
- Create basic Rspack host and remote applications
- Configure Module Federation 2.0 in Rspack
- Implement Zephyr integration for remote resolution

#### Structure
- `/Users/zackarychapple/code/zephyr-packages/examples/rspack-mf2/host` - Host application
- `/Users/zackarychapple/code/zephyr-packages/examples/rspack-mf2/remote` - Remote application
- `/Users/zackarychapple/code/zephyr-packages/examples/rspack-mf2/shared` - Shared libraries

#### Integration Points
- Configure Rspack plugin for Module Federation 2.0
- Implement Zephyr runtime with version detection
- Add support for Rspack-specific features

### 2. Vite 6.0 with Rolldown and MF 2.0

#### Setup
- Create basic Vite host and remote applications
- Configure Rolldown for bundling
- Implement Module Federation 2.0 integration with Vite/Rolldown
- Add Zephyr integration for remote resolution

#### Structure
- `/Users/zackarychapple/code/zephyr-packages/examples/vite-rolldown-mf2/host` - Host application
- `/Users/zackarychapple/code/zephyr-packages/examples/vite-rolldown-mf2/remote` - Remote application
- `/Users/zackarychapple/code/zephyr-packages/examples/vite-rolldown-mf2/shared` - Shared libraries

#### Integration Points
- Configure Vite plugins for Module Federation 2.0
- Implement Rolldown-specific optimizations
- Add Zephyr runtime with version detection
- Implement hot module replacement support

### 3. Test Matrix Integration

#### Approach
- Create automated tests for both examples
- Add examples to CI pipeline
- Implement cross-framework compatibility tests

#### Test Cases
- Basic module loading
- Error handling and recovery
- Versioning and conflict resolution
- Performance benchmarks

## Dependencies

- Rspack (latest version)
- Vite 6.0
- Rolldown (latest version)
- Module Federation 2.0 plugins for both frameworks
- Zephyr packages with MF 2.0 support

## Documentation Deliverables

- Setup instructions for each example
- Integration guide for each framework
- Common patterns and best practices
- Troubleshooting guide

## Timeline

1. Day 1-2: Setup basic examples for both frameworks
2. Day 3-4: Implement MF 2.0 integration
3. Day 5-6: Add Zephyr integration and test
4. Day 7: Add to test matrix and documentation

## Success Criteria

- Both examples successfully demonstrate MF 2.0 integration with Zephyr
- All tests pass in the test matrix
- Documentation is comprehensive and accurate
- Examples show optimal performance and error handling