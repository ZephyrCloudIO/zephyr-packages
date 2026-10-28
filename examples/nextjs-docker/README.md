# Next.js in Docker with Zephyr Assets

Next.js renders in your own Docker container, and Zephyr serves every `/_next/static`
file from a pinned deployment. Zephyr never renders this app: the upload is a plain
static snapshot, so Zephyr's own SSR runtime is never involved.

## Run it

From the repository root:

```bash
pnpm install
pnpm --filter zephyr-nextjs-plugin build
cd examples/nextjs-docker
pnpm build              # next build + upload /_next/static to Zephyr
pnpm docker:build
pnpm docker:run         # http://localhost:3000
```

`pnpm start` runs the same server without Docker. `pnpm dev` is the plain Next.js dev
server, without Zephyr.

## How it works

```text
browser ──► your container (Docker, ECS, Kubernetes, ...)
              zephyr-server.mjs
              ├─ /_next/static/*  ──► Zephyr version URL (streamed back)
              └─ everything else  ──► Next.js server.js (pages, route handlers, server actions)
```

`withZephyr()` in [`next.config.ts`](next.config.ts) sets `output: 'standalone'` and
registers the `zephyr-nextjs-plugin` adapter. When `next build` finishes, the adapter:

1. Uploads `/_next/static/**` to Zephyr and receives the deployment's immutable version
   URL.
2. Writes `.next/zephyr/` with `zephyr-deployment.json` (version URL and Next.js build
   ID), the `zephyr-server.mjs` front door, and a copy of `public/`. These files are laid
   out to match `.next/standalone`, which nests `server.js` under the app's path in a
   monorepo like this one.

The [`Dockerfile`](Dockerfile) copies `.next/standalone/` and `.next/zephyr/` into the
image. `zephyr-server.mjs` starts Next's own `server.js` unchanged on an internal port.
In front of it, the front door streams `/_next/static/*` from Zephyr and sends every
other request to Next.js. The image contains no client assets.

### Why the container proxies `/_next/static`

Next.js bakes `assetPrefix` into the client build, but the Zephyr URL only exists after
the build uploads. Setting the prefix at runtime fixes the `<script>` tags in the HTML.
Chunks referenced from React Server Component payloads still load from the page origin,
and the page never hydrates. Keeping the browser on one origin avoids the problem with
both Turbopack and webpack, and it needs no CORS setup.

For production, put a CDN in front of the container. Every `/_next/static` response is
sent with `Cache-Control: public, max-age=31536000, immutable`.

### Rendering the right version

An image holds the server for exactly one build, and that build's assets live at one
immutable Zephyr version URL:

- Each `pnpm build` creates a new Zephyr version and a new Next.js build ID. Tag the
  image to match, for example with the build number Zephyr prints.
- On startup, the front door requests a file that only exists under
  `/_next/static/<buildId>/` on the configured Zephyr URL. If the file is missing, the
  container logs the mismatch and exits with code 1 instead of serving pages that
  reference another release's chunks.
- `ZEPHYR_URL` overrides the recorded URL, for example to read the same deployment
  through a custom domain. The same check applies.
- Every response carries an `x-zephyr-origin` header naming the deployment behind it.

Rolling out a release means rolling out an image. Rolling back means running the
previous image: its Zephyr version URL never changes.

| Variable             | Default                      | Purpose                                   |
| -------------------- | ---------------------------- | ----------------------------------------- |
| `PORT`               | `3000`                       | Public port of the container              |
| `ZEPHYR_URL`         | URL recorded by `pnpm build` | Zephyr deployment serving `/_next/static` |
| `NEXT_INTERNAL_PORT` | `PORT + 1`                   | Private port of the Next.js server        |

Inside the app, `process.env.ZEPHYR_URL` holds the deployment in use; the home page
shows it. `/healthz` answers `ok` for Docker, load balancer, and Kubernetes health
checks.

Build on Linux (CI) when the app uses dependencies with native binaries, such as
`sharp` for `next/image`: the standalone output copies the binaries installed on the
build machine.
