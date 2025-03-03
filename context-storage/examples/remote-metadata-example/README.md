# Remote Entry Structure Sharing Example

This example demonstrates the Remote Entry Structure Sharing functionality from the Zephyr Module Federation project, enabling improved metadata sharing between federated modules.

## Structure

The example consists of the following applications:

- **Host**: A Next.js application that consumes multiple remotes
- **Remote A**: A Next.js SSR remote application
- **Remote B**: A Vite CSR remote application (placeholder - to be implemented)
- **Remote C**: A Webpack remote application (placeholder - to be implemented)

## Features Demonstrated

- **Metadata Extraction**: Automatic detection of framework and rendering type
- **Metadata Publishing**: Generation of metadata files alongside remoteEntry
- **Metadata Consumption**: Fetching and validating remote metadata
- **Compatibility Checking**: Validation between host and remotes
- **Framework-Specific Optimizations**: Appropriate rendering strategies based on remote type

## Getting Started

### Running the Host

```bash
cd host
npm install
npm run dev
```

The host will be available at http://localhost:3000.

### Running Remote A (Next.js SSR)

```bash
cd remote-a
npm install
npm run dev
```

Remote A will be available at http://localhost:3001.

### Running Remote B (Vite CSR)

```bash
cd remote-b
npm install
npm run dev
```

Remote B will be available at http://localhost:3002 (to be implemented).

### Running Remote C (Webpack)

```bash
cd remote-c
npm install
npm run dev
```

Remote C will be available at http://localhost:3003 (to be implemented).

## Implementation Details

### Host Application

The host application uses the `RemoteStructureSharingIntegration.setupConsumerPlugin` to fetch and validate metadata from remote applications. It displays compatibility information and implements appropriate rendering strategies based on the remote type.

### Remote Applications

Each remote application uses the `RemoteStructureSharingIntegration.setupBundlerPlugin` to extract and publish metadata alongside its remoteEntry file. The metadata includes information about the framework, rendering type, and exposed components.

## Remote Entry Metadata

The metadata for each remote includes:

- **schemaVersion**: Version of the metadata schema
- **moduleFederationVersion**: Version of Module Federation used
- **renderType**: The rendering approach (SSR, CSR, universal)
- **framework**: The JavaScript framework used
- **frameworkVersion**: Version of the framework
- **dependencies**: Key dependencies and their versions
- **exports**: Information about exposed components

## Compatibility Rules

The example demonstrates the following compatibility rules:

1. **RenderType**:
   - CSR host cannot consume SSR remotes (incompatible)
   - SSR host can consume CSR remotes (warning only)
   - Universal rendering is compatible with both CSR and SSR

2. **Framework**:
   - Different frameworks generate warnings but are not considered incompatible
   - "unknown" framework is compatible with any framework

3. **Dependencies**:
   - Different versions of the same dependency generate warnings
   - Major version differences in React or other core libraries may cause runtime issues