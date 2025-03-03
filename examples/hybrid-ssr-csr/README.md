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
   pnpm start
   ```

3. Open the host application in your browser:
   ```
   http://localhost:3000
   ```

## Project Structure

```
/hybrid-ssr-csr
  /host            # Next.js application combining SSR and CSR
  /ssr-remote      # Remote exposing server-renderable components
  /csr-remote      # Remote exposing client-only components
  /shared          # Shared utilities and types
```

## Implementation Details

This example demonstrates several advanced patterns for combining SSR and CSR with Module Federation:

1. **Progressive Enhancement**: Starting with server-rendered content and enhancing with client-side interactivity
2. **Different Rendering Strategies**: Components can declare their rendering strategy (Server Component or Client Component)
3. **Cross-Remote Dependencies**: Client components can depend on server components and vice versa
4. **Dynamic Code Splitting**: Code splitting that respects server/client boundaries
5. **Performance Optimization**: Strategic loading of components based on visibility and user interaction

## Development Notes

- The SSR remote uses React Server Components and must be compatible with RSC constraints
- The CSR remote uses traditional client-side components with hooks and state
- The host application orchestrates both rendering modes and manages hydration