# Next.js SSR with Module Federation and Zephyr

This example demonstrates Server-Side Rendering (SSR) with Module Federation and Zephyr integration using Next.js App Router.

## Overview

The example includes:

1. A **Host Application** that consumes remote components and renders them on the server
2. A **Remote Application** that exposes components to be consumed by the host
3. **Shared Libraries** with common utilities and types

The demo showcases:

- Server-side rendering of remote components
- Hydration of server-rendered components on the client
- State transfer from server to client using Zephyr SSR Store
- Dynamic loading of remote components on the client
- Fallback mechanisms for component loading failures
- Version-specific remote loading

## Getting Started

### Installation

From the project directory:

```bash
# Install dependencies for host application
cd host
npm install

# Install dependencies for remote application
cd ../remote
npm install

# Install dependencies for shared libraries
cd ../shared
npm install
```

### Running the Example

1. Start the remote application:

```bash
cd remote
npm run dev
```

2. In a separate terminal, start the host application:

```bash
cd host
npm run dev
```

3. Open your browser to http://localhost:3000 to see the host application

## Structure

### Host Application

The host application is a Next.js App Router application that consumes components from the remote application. It renders some components on the server and others on the client.

Key features:

- Server Components that load and render remote components on the server
- Client Components that dynamically load remote components
- SSR state management for server-to-client state transfer
- Fallback mechanisms for remote loading failures

### Remote Application

The remote application is a Next.js App Router application that exposes components to be consumed by the host application. It includes both client and server components.

Exposed components:

- `./Button` - A client component with state
- `./ServerComponent` - A server component with nested client components

### Shared Libraries

Shared libraries contain common code used by both the host and remote applications:

- Types for SSR state management
- Utilities for component hydration
- Helper functions for state transfer

## Technical Details

### Server-Side Rendering

The example demonstrates true server-side rendering of remote components. The host application imports and renders remote components on the server, then hydrates them on the client.

The process works as follows:

1. Host application server imports remote components using Module Federation
2. Components are rendered on the server, generating HTML
3. Component state is captured and serialized into the SSR Store
4. HTML and state are sent to the client
5. Client-side JavaScript re-hydrates the components with their initial state
6. Components resume normal operation on the client

### Zephyr Integration

Zephyr provides several key enhancements to the Module Federation system:

- `ssrEnabled` flag for SSR-compatible remotes
- Version-specific loading of remotes
- Fallback mechanisms for remote loading failures
- State transfer between server and client

## Customization

You can customize this example by:

1. Adding new remote components
2. Modifying the SSR state management
3. Adding more complex server components
4. Implementing additional fallback strategies
5. Testing with different remote versions

## Troubleshooting

If you encounter issues:

1. Ensure both applications are running
2. Check browser console for errors
3. Verify the remote entry URL in the host's configuration
4. Confirm shared dependencies have matching versions
5. Check that SSR is properly enabled in both applications

## Further Improvements

Future enhancements could include:

1. Adding more sophisticated state management
2. Implementing streaming SSR for incremental loading
3. Adding advanced caching strategies
4. Supporting partial hydration for improved performance
5. Adding telemetry for monitoring component loading