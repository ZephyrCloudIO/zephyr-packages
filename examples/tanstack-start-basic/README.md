# TanStack Start with Zephyr Example

This example demonstrates a TanStack Start application deployed to Cloudflare using the Zephyr plugin.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Zephyr API credentials (optional for local development)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Building for Production

```bash
npm run build
```

This will:
1. Build the TanStack Start application for SSR
2. Upload assets to Zephyr using the `vite-plugin-tanstack-start-zephyr` plugin
3. Create a deployment snapshot with `type: 'ssr'`

## Configuration

The Zephyr plugin is configured in `vite.config.ts`:

```typescript
withZephyrTanstackStart()
```

That's it! The plugin automatically detects:

- **App UID**: Generated from `package.json` name + git org/project
- **Environment**: Detected from git branch and CI context
- **API Configuration**: Loaded from Zephyr cloud after authentication
- **Authentication**: Handled via `ze login` command

### Authentication

Before building, authenticate with Zephyr:

```bash
ze login
```

This stores your authentication token locally and allows the plugin to deploy your application.

## Features

This example includes:

- **Server Functions**: Server-side functions that can be called from the client
- **API Routes**: Type-safe API endpoints
- **SSR Demos**: Examples of different SSR modes (SPA, Full SSR, Data-only)
- **TailwindCSS**: Modern styling with Tailwind
- **Lucide Icons**: Icon library for UI elements

## Routes

- `/` - Home page with feature overview
- `/demo/start/server-funcs` - Server function demonstration
- `/demo/start/api-request` - API request example
- `/demo/start/ssr` - SSR demonstrations index
  - `/demo/start/ssr/spa-mode` - SPA mode
  - `/demo/start/ssr/full-ssr` - Full server-side rendering
  - `/demo/start/ssr/data-only` - Data-only SSR

## Architecture

The application uses the simplified SSR architecture described in `SIMPLIFIED_ARCHITECTURE.md`:

1. **Build**: Vite builds server and client bundles to `dist/server/` and `dist/client/`
2. **Upload**: Plugin uploads all files (server + client) to Zephyr with `type: 'ssr'`
3. **Deploy**: Orchestration worker loads JavaScript modules and creates worker isolates
4. **Serve**: Each request is handled by the worker isolate with TanStack Start

## Testing

```bash
npm run test
```

## Learn More

- [TanStack Start Documentation](https://tanstack.com/start)
- [TanStack Router Documentation](https://tanstack.com/router)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
