# zephyr-nextjs-plugin

<div align="center">

[Zephyr Cloud](https://zephyr-cloud.io) | [Zephyr Docs](https://docs.zephyr-cloud.io) | [Discord](https://zephyr-cloud.io/discord) | [Twitter](https://x.com/ZephyrCloudIO) | [LinkedIn](https://www.linkedin.com/company/zephyr-cloud/)

<hr/>
<img src="https://cdn.prod.website-files.com/669061ee3adb95b628c3acda/66981c766e352fe1f57191e2_Opengraph-zephyr.png" alt="Zephyr Logo" />
</div>

A Next.js adapter for running Next.js on your own servers while Zephyr Cloud serves the
client assets. Zephyr hosts `/_next/static`; your container renders every page.

## Installation

```bash
pnpm add --save-dev zephyr-nextjs-plugin
```

Requires Next.js 16.4 or later (stable `adapterPath`).

## Usage

```ts
// next.config.ts
import type { NextConfig } from 'next';
import { withZephyr } from 'zephyr-nextjs-plugin';

const nextConfig: NextConfig = {};

export default withZephyr(nextConfig);
```

`withZephyr()` also accepts a config function. It sets `output: 'standalone'` and
registers the adapter. It rejects `assetPrefix`, any other `output`, and a second adapter.

After `next build`, the adapter:

1. Uploads every `/_next/static/**` file to Zephyr as a static (`csr`) snapshot. Zephyr
   serves the files and never renders the app.
2. Writes `.next/zephyr/zephyr-deployment.json` with the immutable version URL and the
   Next.js build ID.
3. Copies `zephyr-server.mjs`, a dependency-free Node server, and `public/` into
   `.next/zephyr/`, laid out to match `.next/standalone` (which nests `server.js` under
   the app's path in a monorepo).

## Running the server

Copy `.next/standalone/` and then `.next/zephyr/` into the same folder and start
`zephyr-server.mjs`:

```dockerfile
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY .next/standalone/ ./
COPY .next/zephyr/ ./
USER node
CMD ["node", "zephyr-server.mjs"]
```

`zephyr-server.mjs` starts Next's generated `server.js` unchanged on an internal port.
On the public port, it streams `/_next/static/*` from the Zephyr deployment and passes
all other requests to Next.js. Static responses are sent as
`public, max-age=31536000, immutable`, and every response carries an `x-zephyr-origin`
header.

Before it accepts traffic, the server requests a file under
`/_next/static/<buildId>/` from the Zephyr URL. If that file is missing, the server
exits with code 1, so an image never serves HTML that references another build's
chunks.

| Variable             | Default                    | Purpose                                   |
| -------------------- | -------------------------- | ----------------------------------------- |
| `PORT`               | `3000`                     | Public port                               |
| `ZEPHYR_URL`         | URL recorded at build time | Zephyr deployment serving `/_next/static` |
| `NEXT_INTERNAL_PORT` | `PORT + 1`                 | Private port of the Next.js server        |

`process.env.ZEPHYR_URL` is set for application code as well.

### Why not `assetPrefix`?

The Zephyr URL only exists after the build uploads, while Next.js bakes `assetPrefix`
into the client build. Setting the prefix at runtime fixes only the HTML tags. Chunks
referenced from React Server Component payloads still load from the page origin, and
hydration fails. Serving `/_next/static` through the same origin avoids that with both
Turbopack and webpack. Put a CDN in front of the container to cache the immutable files.

## Example

[`examples/nextjs-docker`](../../examples/nextjs-docker) builds a Docker image this way.

## License

Apache-2.0
