# Hybrid SSR/CSR Example Implementation Plan

This document outlines the implementation plan for the Hybrid SSR/CSR Example, demonstrating a progressive enhancement approach with Module Federation.

## Project Structure

```
/hybrid-ssr-csr
  /host                 # Next.js host application
    /src
      /app              # Next.js App Router routes
        /page.tsx       # Home page (SSR)
        /products       # Products page with hybrid rendering
        /reviews        # Reviews page with client-side rendering
      /components       # Local components
  
  /ssr-remote           # Next.js SSR-compatible remote
    /src
      /components       # Server components
        /ServerProduct.tsx
        /ServerCard.tsx
        /ServerHeader.tsx
  
  /csr-remote           # Vite CSR-only remote
    /src
      /components       # Client components
        /ClientProduct.tsx
        /ClientCarousel.tsx
        /ClientReviews.tsx
  
  /shared               # Shared library
    /src
      /types.ts         # Shared types
      /theme.ts         # Theme configuration
      /utils.ts         # Utility functions
      /federation-context.ts # State management context
```

## Implementation Phases

### Phase 1: Infrastructure Setup ✅

- Set up project structure and configurations
- Create package.json files with correct dependencies
- Configure Module Federation for all applications
- Set up TypeScript configurations
- Create shared library with types and context

### Phase 2: Remote Components Implementation

- Implement SSR remote components
  - ServerProduct: Server-rendered product component
  - ServerCard: Server-rendered card component
  - ServerHeader: Server-rendered header component
- Implement CSR remote components
  - ClientProduct: Interactive product component with add-to-cart functionality
  - ClientCarousel: Interactive image carousel
  - ClientReviews: Dynamic reviews component with loading states

### Phase 3: Host Application Implementation

- Create layout with server-rendered structure
- Implement home page with server components
- Create products page with hybrid rendering approach
  - Server-rendered product grid (SSR remote)
  - Client-side interactive filters (CSR remote)
- Implement reviews page with client-side rendering
  - Server-rendered header (SSR remote)
  - Client-side reviews list with lazy loading (CSR remote)

### Phase 4: Progressive Enhancement Features

- Implement page transitions using client components
- Add lazy loading for below-the-fold content
- Create fallbacks for non-critical client components
- Implement selective hydration strategies
- Add error boundaries for remote component failures

### Phase 5: State Management

- Implement server-to-client state transfer
- Create shared context for cross-remote communication
- Add persistence for client-side state
- Implement hydration of interactive components

### Phase 6: Testing and Documentation

- Create tests for both server and client rendering
- Test different rendering scenarios and fallbacks
- Document implementation approach and architecture
- Add deployment instructions

## Technical Approach

### Server Components (Next.js App Router)

- Created as React Server Components (RSC)
- Rendered on the server only
- No hooks, state, or browser APIs
- Generate static HTML sent to the client

### Client Components

- Standard React components with "use client" directive
- Full access to hooks, state, and browser APIs
- Hydrated on the client for interactivity
- Lazy-loaded for performance optimization

### Hybrid Pages

- Server-rendered shell for fast initial load
- Progressive enhancement with client components
- Strategic hydration of interactive elements
- Shared state between server and client components

## Key Features

1. **Islands Architecture**: Server-rendered HTML with islands of interactivity
2. **Progressive Loading**: Start with essential content, enhance progressively
3. **Selective Hydration**: Hydrate critical components first
4. **Component-level Granularity**: Each component decides its rendering strategy
5. **Cross-remote Communication**: Shared context for state management

## State Management

- Initial state generated on the server
- Transferred to client via serialization/deserialization
- Shared context for cross-component communication
- Persistence via localStorage on the client

## Performance Considerations

- Minimize client-side JavaScript
- Prioritize critical rendering path
- Use streaming where available
- Implement lazy loading for non-critical components
- Optimize hydration with selective strategies