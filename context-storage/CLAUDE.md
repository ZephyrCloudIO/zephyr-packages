# CLAUDE.md - Zephyr Packages Implementation Guide

This file provides critical context and commands for implementing the Zephyr Packages project, helping Claude maintain continuity between sessions.

## Project Status

We are currently implementing Phase 5 of the Zephyr Packages project, focusing on Enhanced Configuration Support. The status of the three main components is:

1. **BaseHref Implementation**: 80% complete
2. **Remote Types Detection**: 80% complete
3. **Remote Entry Structure Sharing**: 95% complete

The Remote Entry Structure Sharing component has been our latest focus and is nearly complete.

## Key Files to Check After /compact

When resuming after using the /compact command, follow these steps:

1. Check implementation status file first: `/context-storage/implementation-status.md`
2. Review the implementation plan in `/zephyr-implementation-plan.md`
3. Look at the Phase 5 summary in `/context-storage/phase5-complete-summary.md`
4. Examine the completed components in:
   - For Remote Entry Structure Sharing:
     - `/context-storage/remote-entry-structure-sharing-skeleton.ts` - Implementation
     - `/context-storage/tests/remote-entry-structure-sharing-integration.test.ts` - Integration tests
     - `/context-storage/phase5-remote-entry-structure-sharing-docs.md` - Documentation
     - `/context-storage/remote-entry-structure-sharing-example.md` - Example design
     - `/context-storage/plugin-integration-sample.ts` - Plugin integration
     - `/examples/remote-metadata-example/` - Partially implemented example

## Implementation Process

We follow a Test-Driven Development (TDD) approach:

1. Create test cases in a "red phase" document
2. Implement skeleton code structure
3. Implement full functionality to make tests pass
4. Refactor and optimize
5. Create documentation and examples

## Next Steps

The remaining tasks for completing Remote Entry Structure Sharing:

1. Complete the example application by implementing:
   - Remote B as a Vite CSR application
   - Remote C as a Webpack application
2. Perform final testing and optimization
3. Update documentation with real-world examples

## Development Commands

### Running Tests

```bash
cd context-storage
npm test
```

### Building Example Applications

```bash
cd examples/remote-metadata-example/host
npm install
npm run dev
```

```bash
cd examples/remote-metadata-example/remote-a
npm install
npm run dev
```

## Key Concepts

### Remote Entry Structure Sharing

This component allows federated modules to share metadata about their:
- Rendering strategy (CSR/SSR/Universal)
- Framework and version
- Dependencies
- Exposed components

It enables improved compatibility checking, better error messages, and framework-specific optimizations.

### BaseHref Implementation

Provides consistent path handling for applications deployed to non-root paths, ensuring proper URL construction for:
- Static assets
- API calls
- Module Federation remotes

### Remote Types Detection

Automatically detects and configures applications as:
- Client-Side Rendered (CSR)
- Server-Side Rendered (SSR)
- Universal Rendering

This improves integration between remotes with different rendering strategies.