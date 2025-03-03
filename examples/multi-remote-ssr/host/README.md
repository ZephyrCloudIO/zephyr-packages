# Multi-Remote SSR Example: Host Application

This is the host application for the multi-remote SSR example, demonstrating how to consume components from multiple federated remote applications with server-side rendering.

## Features

- Integration of components from three remote applications
- Server-side rendering with Next.js App Router
- Shared state management across remotes
- Theme switching that affects all integrated components
- Comprehensive example of Module Federation 2.0 with SSR

## Application Structure

The host application integrates the following components from remote applications:

### Remote A (Navigation Shell)
- Header component for the top navigation bar
- Navigation component for the sidebar menu
- UserProfile component for user authentication

### Remote B (Content and Products)
- ContentBlock component for displaying structured content
- ProductList component for displaying product catalogs
- ProductCard component for individual product displays

### Remote C (UI Utilities)
- Modal component for dialogs and popups
- Notification component for user alerts
- Loading component for loading states

## Pages

- **Home**: Demonstrates integration of all remotes in a dashboard layout
- **Products**: Showcases Remote B's product catalog functionality
- **About**: Detailed information and demonstrations of Remote C's utility components

## State Management

The application uses a shared context system for cross-remote state management:

- Theme setting is synchronized across all remotes
- User authentication status is shared
- Component-specific state is maintained during SSR and hydration

## Technical Implementation

- Module Federation 2.0 with Next.js integration
- SSR with proper hydration of remote components
- Dynamic imports with React.lazy and Suspense
- Federation Provider for shared context
- Host-remote communication via events

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Make sure the remote applications are running:
   - Remote A on port 3001
   - Remote B on port 3002
   - Remote C on port 3003

## Running in Production Mode

To build and run the application in production mode:

```
npm run build
npm run start
```

## Configuration

The Module Federation configuration is defined in `next.config.js`:

- Remote endpoints and shared dependencies are configured
- SSR-specific options are enabled
- Special handling for Next.js internals is implemented

## Notes on SSR Implementation

- Remote components are imported with React.lazy for proper SSR handling
- Each component is wrapped in Suspense boundaries
- Initial state is created on the server and transferred to the client
- The FederationProvider ensures consistent state during hydration
- Server and client components collaborate to provide a seamless experience