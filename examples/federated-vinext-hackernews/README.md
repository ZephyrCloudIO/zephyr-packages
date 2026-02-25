# Federated Vinext HackerNews

Module Federation + Vinext (Next.js on Vite) demo. A Hacker News clone where the **Stories list** is loaded from a separately compiled and deployed remote app via Module Federation.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Host (Vinext app on Cloudflare Workers)    │
│                                             │
│  RSC fetches storyIds server-side           │
│       │                                     │
│       ▼                                     │
│  <RemoteStories> (client component)         │
│       │                                     │
│       │  @module-federation/runtime          │
│       │  loadRemote('stories_remote/Stories')│
│       ▼                                     │
│  ┌──────────────────────────────────┐       │
│  │  Remote (Vite React app)         │       │
│  │  Exposes: ./Stories              │       │
│  │  Fetches story data client-side  │       │
│  └──────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

**Host** — Vinext app using React Server Components. Fetches story IDs server-side, then delegates rendering to the federated Stories component on the client.

**Remote** — Standard Vite React app. Exposes the `Stories` component via `@module-federation/vite`. Each story's data is fetched client-side from the HN Firebase API.

## Running

```bash
# Install dependencies from the monorepo root
pnpm install

# Terminal 1: Start the remote (must start first)
cd examples/federated-vinext-hackernews/remote
pnpm dev

# Terminal 2: Start the host
cd examples/federated-vinext-hackernews/host
pnpm dev
```

The remote runs on `http://localhost:5174` and the host on Vite's default port.

## Key Files

| File | Description |
|------|-------------|
| `host/app/news/[page]/page.tsx` | RSC page that fetches storyIds and renders RemoteStories |
| `host/components/remote-stories.tsx` | Client component bridging RSC and Module Federation |
| `remote/vite.config.ts` | Federation config exposing `./Stories` |
| `remote/src/components/Stories.tsx` | Client-side Stories component |

## How It Works

1. The host uses `@module-federation/runtime` (not the build plugin) to avoid conflicts with Vinext's multi-environment builds (RSC + SSR + client)
2. The remote uses `@module-federation/vite` build plugin to generate `remoteEntry.js`
3. On the host, `remote-stories.tsx` is a `'use client'` component that initializes the federation runtime and loads the Stories component via `React.lazy` + `loadRemote`
4. If the remote is unreachable, the host shows a graceful error message via an error boundary
