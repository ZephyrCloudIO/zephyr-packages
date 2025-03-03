# Multi-Remote SSR Example

This example demonstrates a complex Server-Side Rendering (SSR) setup with multiple remote applications sharing state through Module Federation and Zephyr integration.

## Overview

The example consists of:

1. **Host Application**:
   - Integrates components from all three remotes
   - Manages unified layout and navigation
   - Provides central state management
   - Contains multiple pages demonstrating different integration patterns

2. **3 Remote Applications**:
   - **Remote A** (Header & Navigation): Provides header components with navigation elements
   - **Remote B** (Products & Content): Provides product and content components
   - **Remote C** (UI Utilities): Provides common UI utilities like notifications, modals, and loading indicators

3. **Shared State Management**:
   - Global theming across all remotes
   - User authentication state
   - Shared context with permissions and preferences
   - Cross-remote events

4. **Server-Side Rendering**:
   - Components are initially rendered on the server
   - State is serialized and transferred to the client
   - Client-side hydration with preserved state
   - Remotes communicate through a shared federation context

## Architecture

The architecture follows these key principles:

1. **Isolated Responsibilities**: Each remote has a specific set of components and responsibilities
2. **Shared Context**: All remotes share a common context for state management
3. **Server Rendering**: Components can be rendered on the server and hydrated on the client
4. **Type Safety**: TypeScript is used throughout for type safety and better developer experience
5. **Event Communication**: Remotes can dispatch events that other remotes can listen to

## Getting Started

### Prerequisites

- Node.js 16+
- npm or pnpm

### Installation

From the project directory:

```bash
# Install dependencies for all applications
npm install
```

### Running the Example

Start each remote application in a separate terminal:

```bash
# Start Remote A (Header & Navigation)
cd remote-a
npm run dev

# Start Remote B (Products & Content)
cd remote-b
npm run dev

# Start Remote C (UI Utilities) 
cd remote-c
npm run dev

# Start the Host application (when implemented)
cd host
npm run dev
```

## Components Overview

### Remote A: Header & Navigation

- **Header**: A responsive header component with theme switching
- **Navigation**: A navigation menu component with active state
- **UserProfile**: A user profile component with authentication state

### Remote B: Products & Content

- **ProductCard**: A product card component for displaying product details
- **ProductList**: A list of products with filtering and sorting capabilities
- **ContentBlock**: A content block component for displaying formatted content

### Remote C: UI Utilities

- **Notification**: A notification component with different types (info, success, warning, error)
- **Modal**: A modal dialog component with customizable size and content
- **Loading**: Loading indicators with different styles (spinner, dots, pulse, skeleton)

## Shared Context

The shared context provides:

- **Theme**: Light/dark mode that affects all remotes
- **User Information**: User ID, permissions, and preferences
- **Locale**: Language and region settings
- **Features**: Feature flags for enabling/disabling functionality

## SSR Implementation

The SSR implementation involves:

1. **Server Rendering**: Components are rendered on the server with initial state
2. **State Transfer**: Component state is serialized and included in the HTML response
3. **Hydration**: Client JavaScript rehydrates the components with preserved state
4. **Runtime Synchronization**: Components maintain synchronized state after hydration

## Technical Details

### Remote Communication

Components from different remotes can communicate through:

1. **Federation Context**: A shared context that all remotes can access
2. **Event System**: Publish/subscribe pattern for cross-remote events
3. **Shared State**: Direct state sharing through the common context
4. **URL Parameters**: State can be passed through URL parameters

### SSR Store Structure

The SSR store follows this structure:

```typescript
{
  // Component state for each remote
  remotes: {
    'remote_a': {
      'component_id': {
        // Component-specific state
        id: 'component_id',
        // Other properties...
        hydrated: false
      }
    },
    // Other remotes...
  },
  
  // Shared context available to all remotes
  sharedContext: {
    theme: 'light',
    userId: 'user123',
    // Other shared state...
  },
  
  // Metadata about the rendering
  meta: {
    renderedAt: '2025-03-03T12:34:56.789Z',
    remoteVersions: {
      'remote_a': '0.1.0',
      'remote_b': '0.1.0',
      'remote_c': '0.1.0'
    },
    renderMode: 'ssr'
  }
}
```

## Pages in Host Application

The host application includes several pages that demonstrate different integration patterns:

1. **Home Page**:
   - Features content blocks from Remote B
   - Product listing from Remote B
   - Modal and notification components from Remote C
   - Theme switching that affects all remote components

2. **Products Page**:
   - Complete product catalog with Remote B components
   - Filtering and sorting functionality
   - State persistence across component instances
   - Integration with Remote C's notification system

3. **About Page**:
   - Demonstrates Remote C's utility components
   - Interactive modals with dynamic content
   - Different notification types and styles
   - Technical information about the implementation

## Next Steps

The next steps for this example include:

1. Creating a Hybrid SSR/CSR example that demonstrates progressive enhancement
2. Implementing a Streaming SSR example with React 18+ features
3. Adding tests for SSR functionality with specialized testing framework
4. Optimizing performance with partial hydration
5. Adding analytics and monitoring

## Troubleshooting

Common issues and their solutions:

1. **Hydration Mismatch**: Ensure server and client render the same content initially
2. **Missing Context**: Check that the FederationProvider is properly set up
3. **CSS Conflicts**: Use scoped styles or CSS-in-JS for component styling
4. **Version Conflicts**: Ensure shared libraries have matching versions across remotes

## Related Documentation

- [Zephyr Documentation](https://example.com/zephyr-docs)
- [Module Federation Documentation](https://example.com/module-federation)
- [React Server Components](https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023#react-server-components)
- [Next.js App Router](https://nextjs.org/docs/app)