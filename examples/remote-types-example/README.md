# Remote Types Detection Examples

This directory contains example applications demonstrating the Remote Types Detection functionality implemented in the Zephyr packages project. These examples show how to automatically detect and configure the rendering approach (CSR/SSR) and framework across different bundlers.

## Examples

### Vite Example

A React application built with Vite, demonstrating:
- Automatic detection of render type (CSR/SSR)
- Framework detection
- Manifest file generation
- Runtime access to remote types information via virtual module
- Support for both CSR and SSR builds

[View Vite Example](./vite-app)

### Webpack Example

A React application built with Webpack and Module Federation, demonstrating:
- Automatic detection of render type (CSR/SSR)
- Framework detection
- Manifest file generation
- Runtime access to remote types information via global variable
- Module Federation integration with render type metadata
- Support for both CSR and SSR builds

[View Webpack Example](./webpack-app)

## Functionality Overview

The Remote Types Detection functionality provides automatic detection and configuration for Client-Side Rendering (CSR) and Server-Side Rendering (SSR) applications. This is crucial for properly integrating federated modules with different rendering approaches.

### Key Features

1. **Automatic Detection**: Identifies rendering approach from dependencies, configuration, and entry points
2. **Framework Detection**: Recognizes popular frameworks like Next.js, Remix, Gatsby, and others
3. **Configuration Options**: Supports explicit configuration overrides with validation
4. **Manifest Integration**: Enhances manifests with render type and framework information
5. **Confidence-Based Resolution**: Intelligently resolves conflicting detection signals
6. **Plugin Integration**: Provides bundler plugins for Vite and Webpack/Rspack

## Remote Entry Structure Sharing Integration

The examples also demonstrate integration with the Remote Entry Structure Sharing feature:

1. **Enhanced Metadata**: Remote types information is added to the shared metadata
2. **Compatibility Checking**: Ensures compatibility between different render types
3. **Runtime Type Safety**: Provides type information for federated components

## Usage

Each example includes detailed instructions on how to:
1. Install dependencies
2. Run the application in CSR mode
3. Run the application in SSR mode
4. Build the application for production

## Benefits

The Remote Types Detection functionality provides significant benefits:

1. **Improved Integration**: Enables better integration between CSR and SSR federated modules
2. **Reduced Configuration**: Minimizes manual configuration through automatic detection
3. **Framework Awareness**: Provides framework-specific optimizations and defaults
4. **Enhanced Metadata**: Enriches manifests with render type and framework information