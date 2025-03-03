# Hybrid SSR/CSR Example with Module Federation

This example demonstrates a hybrid approach to rendering with both Server-Side Rendering (SSR) and Client-Side Rendering (CSR) components using Module Federation.

## Architecture

The application consists of:

- **Host**: Next.js application with App Router, integrating both SSR and CSR components
- **SSR Remote**: Remote application exposing server-renderable components with hydration hooks
- **CSR Remote**: Remote application exposing client-only components with lazy loading
- **Shared Library**: Common utilities, types, and state management

## Key Features

- Progressive enhancement patterns
- Partial hydration strategies
- Component-level SSR/CSR granularity
- Dynamic loading of client components
- Seamless integration between server and client rendering

## Implementation Details

### Host Application

The host application demonstrates several key patterns:

1. **Mixed Rendering Modes**: Components can be server-rendered, client-rendered, or hybrid
2. **Progressive Enhancement**: Start with essential server-rendered content and enhance with client interactivity
3. **Selective Hydration**: Components can be hydrated independently and in priority order
4. **Suspense and Error Boundaries**: Fallbacks and error handling for resilience

### Pages

- **Home Page**: Showcases server components for static content with a client-side carousel
- **Products Page**: Demonstrates server-rendered product information with client-side filtering and interactivity
- **Reviews Page**: Shows client-side rendering focus with form submission capabilities

### Remote Components

#### SSR Remote Components:
- `ServerProduct`: Server-rendered product display
- `ServerCard`: Versatile content card with theme support
- `ServerHeader`: Themeable page header

#### CSR Remote Components:
- `ClientProduct`: Interactive product with add-to-cart functionality
- `ClientCarousel`: Dynamic image carousel with touch support
- `ClientReviews`: Reviews component with form submission

### State Management

We use a shared context system for state management across SSR and CSR components:

1. Initial state is server-generated
2. State is transferred to the client during hydration
3. Client components can modify state
4. State changes trigger re-renders across both SSR and CSR components

## Technical Implementation

- **Server Components**: Rendered on the server, sent as HTML to the client
- **Client Components**: Loaded dynamically on the client with React lazy
- **Islands Architecture**: Server-rendered HTML with interactive client islands
- **Selective Hydration**: Strategic hydration of interactive elements
- **Streaming Rendering**: Progressive delivery of page content

## Running the Example

1. Install dependencies:
   ```bash
   cd examples/hybrid-ssr-csr
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

## Project Structure

```
/hybrid-ssr-csr
  /host            # Next.js application combining SSR and CSR
    /src
      /app         # Next.js App Router routes
      /components  # Local components
  
  /ssr-remote      # Next.js SSR-compatible remote
    /src
      /components  # Server components
  
  /csr-remote      # Vite CSR-only remote
    /src
      /components  # Client components
  
  /shared          # Shared utilities and types
    /src
      /types.ts
      /theme.ts
      /utils.ts
      /federation-context.ts
```

## Performance Considerations

This example demonstrates several performance optimization techniques:

1. **Minimal Client JavaScript**: Server components require no JavaScript on the client
2. **Lazy Loading**: Client components are loaded only when needed
3. **Suspense Boundaries**: Components can load in parallel without blocking the page
4. **Progressive Hydration**: Critical interactive elements are hydrated first
5. **Shared State Management**: Efficient state updates across components