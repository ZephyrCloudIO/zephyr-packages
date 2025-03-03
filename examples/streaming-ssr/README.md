# Streaming SSR Example with Module Federation

This example demonstrates streaming server-side rendering with React 18+ features using Module Federation, showing how to optimize the user experience through progressive loading and selective hydration strategies.

## Architecture

The application consists of:

- **Host**: Next.js application with App Router that implements streaming SSR
- **Remote**: Module Federation remote with suspense-aware components
- **Shell**: Application shell with loading states and streaming infrastructure
- **Shared**: Common utilities, types, and state management

## Demo Pages

The example includes several pages that demonstrate different streaming patterns:

1. **Home Page**: Basic streaming with suspense boundaries
   - Shows fundamental streaming with priority-based loading
   - Demonstrates simple integration of remote components

2. **Product Page**: Progressive loading of critical and non-critical content
   - Prioritizes critical content (product details)
   - Defers non-critical content (comments, recommendations)
   - Uses visibility-based loading for below-the-fold content

3. **Dashboard Page**: Complex streaming with multiple nested suspense boundaries
   - Shows advanced layout with multiple streaming regions
   - Demonstrates resource prioritization for optimal loading order
   - Implements nested suspense boundaries for independent streaming

4. **Article Page**: Streaming long-form content with deferred loading
   - Shows progressive content loading based on scroll position
   - Implements deferred hydration of interactive elements
   - Demonstrates content sectioning for optimal streaming

## Key Features

- React 18+ streaming server rendering
- Suspense boundaries with federated components
- Progressive loading patterns
- Partial hydration strategies
- Selective loading of critical vs. non-critical content

## Components

### Remote Components
- **ProductStream**: Product display with priority-based loading
- **CommentsStream**: Comments section with progressive loading
- **RecommendationsStream**: Grid-based recommendations component
- **ProfileStream**: User profile with simple/detailed modes

### Shell Components
- **StreamingLayout**: Layout component with priority rendering
- **StreamingRegion**: Visibility and priority-based content streaming
- **ProgressiveHydration**: Implements selective hydration strategies
- **ResourcePrioritizer**: Priority-based resource loading management

## Technical Implementation

This example demonstrates several advanced React 18+ features and patterns:

1. **Streaming SSR**: Server-rendered HTML is streamed to the client as it becomes available
2. **Suspense**: Components can suspend during rendering to show loading states
3. **Lazy Loading**: Components are loaded on-demand with dynamic imports
4. **Deferred Loading**: Non-critical content is deferred until after initial render
5. **Progressive Hydration**: Components are hydrated in order of importance
6. **Module Federation**: Remote components are loaded and integrated with streaming
7. **Priority-based Loading**: Critical content is prioritized for faster rendering
8. **Visibility-based Loading**: Content is loaded when it's about to be visible
9. **Error Boundaries**: Graceful handling of remote component failures

## Performance Benefits

Streaming SSR provides several performance benefits:

1. **Faster Time to First Byte (TTFB)**: Content starts streaming immediately
2. **Faster First Contentful Paint (FCP)**: Initial content appears faster
3. **Improved Time to Interactive (TTI)**: Critical components hydrate first
4. **Better Perceived Performance**: Progressive loading feels faster to users
5. **Resilience**: Page doesn't fail if some components take longer to load

## Running the Example

1. Install dependencies:
   ```bash
   cd examples/streaming-ssr
   pnpm install:all
   ```

2. Start all applications:
   ```bash
   pnpm dev
   ```

3. Open the host application in your browser:
   ```
   http://localhost:3000
   ```

## Implementation Details

This example demonstrates how to implement a complete streaming architecture with Module Federation:

- **Strategic Suspense Placement**: Carefully positioned suspense boundaries for optimal streaming
- **Prioritization Framework**: Components declare their priority to coordinate loading
- **Visibility Detection**: Components load based on their visibility status
- **Performance Metrics**: Instrumentation for measuring streaming performance
- **Fallback UI**: Skeleton loaders and placeholders for pending components

For a complete understanding of the implementation, see the COMPLETED.md file.

## Project Structure

```
/streaming-ssr
  /host            # Next.js host application
    /src
      /app         # App Router routes
      /components  # Local components
  
  /remote          # Remote with streaming support
    /src
      /components  # Suspense-aware components
  
  /shell           # Application shell
    /src
      /layouts     # Layout components
      /streaming   # Streaming utilities
  
  /shared          # Shared utilities
    /src
      /types.ts    # Type definitions
      /utils.ts    # Utility functions
```

## Implementation Overview

### Host Application

The host application uses Next.js App Router to implement streaming SSR:

- Uses React 18+ `app` directory structure
- Implements streaming with `loading.tsx` files
- Creates suspense boundaries around federated components
- Defers non-critical content loading

### Remote Components

Remote components are designed for streaming compatibility:

- Support React 18+ suspense
- Include loading states
- Handle asynchronous data fetching
- Support partial hydration

### Application Shell

The shell provides the infrastructure for streaming:

- Creates the application layout
- Manages streaming boundaries
- Handles resource prioritization
- Implements progressive hydration

### Shared Utilities

Shared utilities provide common functionality:

- Type definitions for components
- Streaming-specific utilities
- State management helpers
- Hydration coordination

## Running the Example

1. Install dependencies:
   ```bash
   cd examples/streaming-ssr
   pnpm install
   ```

2. Start all applications:
   ```bash
   pnpm dev
   ```

3. Open the host application in your browser:
   ```
   http://localhost:3000
   ```

## Demo Pages

The example includes several demo pages to showcase different streaming patterns:

1. **Home Page**: Basic streaming with suspense boundaries
2. **Product Page**: Progressive loading of critical and non-critical content
3. **Dashboard**: Complex streaming with multiple nested suspense boundaries
4. **Article**: Streaming long-form content with deferred loading

## Performance Benefits

Streaming SSR provides several performance benefits:

1. **Faster Time to First Byte (TTFB)**: Content starts streaming immediately
2. **Faster First Contentful Paint (FCP)**: Initial content appears faster
3. **Improved Time to Interactive (TTI)**: Critical components hydrate first
4. **Better Perceived Performance**: Progressive loading feels faster to users
5. **Resilience**: Page doesn't fail if some components take longer to load

## Resource Prioritization

This example demonstrates prioritization of resources:

1. **Critical Path Resources**: Loaded and hydrated first
2. **Above-the-fold Content**: Prioritized over below-the-fold content
3. **Interactive Elements**: Hydrated before static elements
4. **Deferred Content**: Loaded after initial render completes