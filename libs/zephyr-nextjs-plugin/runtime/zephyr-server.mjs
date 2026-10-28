/**
 * Zephyr front door for a Next.js standalone build. Copied next to the standalone output by
 * zephyr-nextjs-plugin and run with `node zephyr-server.mjs`.
 *
 * - Next.js's own generated `server.js` runs untouched on an internal port and renders every page,
 *   route handler, and server action.
 * - `/_next/static/*` is streamed from the Zephyr deployment that was uploaded by the same build, so
 *   the image ships no client assets.
 *
 * The browser only ever talks to this server, so chunks referenced from HTML and from RSC payloads
 * share one origin. Before accepting traffic the server checks that the Zephyr URL serves this
 * exact build ID, so a container never renders HTML pointing at another release's chunks.
 *
 * Environment: PORT (default 3000), ZEPHYR_URL (defaults to the version URL recorded at build
 * time).
 *
 * Plain Node.js, no dependencies: it runs from a standalone image as is.
 */
import { readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const deployment = JSON.parse(readFileSync(join(here, 'zephyr-deployment.json'), 'utf8'));
const zephyrUrl = (process.env.ZEPHYR_URL || deployment.url).replace(/\/+$/, '');
const staticPrefix = `${deployment.basePath}/_next/static/`;
const publicPort = Number(process.env.PORT || 3000);
const nextPort = Number(process.env.NEXT_INTERNAL_PORT || publicPort + 1);

// The Zephyr edge treats `*/*` as HTML and may answer a missing file with a page.
// Asking for anything but HTML turns a missing asset into a real 404.
const ASSET_ACCEPT = 'application/javascript, text/css, application/json, */*;q=0.1';
const ASSET_TIMEOUT_MS = 10_000;

function log(level, msg, fields = {}) {
  console[level === 'error' ? 'error' : 'log'](
    JSON.stringify({ level, msg, zephyr: zephyrUrl, buildId: deployment.buildId, ...fields })
  );
}

/** Fails fast when ZEPHYR_URL serves a different build than the one in this image. */
async function verifyDeployment() {
  const probeUrl = `${zephyrUrl}${deployment.probe}`;
  let status = 0;
  try {
    const response = await fetch(probeUrl, {
      headers: { accept: ASSET_ACCEPT },
      signal: AbortSignal.timeout(ASSET_TIMEOUT_MS),
    });
    await response.body?.cancel();
    status = response.status;
  } catch (error) {
    log('error', 'Zephyr deployment unreachable', { probeUrl, error: String(error) });
    process.exit(1);
  }
  if (status !== 200) {
    log(
      'error',
      'Zephyr URL does not serve this build. Point ZEPHYR_URL at the version URL this image was built with.',
      {
        probeUrl,
        status,
      }
    );
    process.exit(1);
  }
}

function waitForPort(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.end();
        resolve(undefined);
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`Next.js did not start on port ${port}`));
        else setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

/** Streams one `/_next/static` file from the Zephyr edge. */
async function serveStatic(req, res) {
  const upstream = await fetch(`${zephyrUrl}${req.url}`, {
    method: req.method,
    headers: { accept: ASSET_ACCEPT },
    signal: AbortSignal.timeout(ASSET_TIMEOUT_MS),
  });
  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
  const found = upstream.ok && !contentType.includes('text/html');
  // fetch() already decoded the body, so content-encoding/length are not forwarded.
  res.writeHead(found ? 200 : 404, {
    'content-type': found ? contentType : 'text/plain',
    // Every file under /_next/static has a content hash or build ID in its path.
    'cache-control': found ? 'public, max-age=31536000, immutable' : 'no-store',
    'x-zephyr-origin': zephyrUrl,
  });
  if (!found || req.method === 'HEAD' || !upstream.body) {
    await upstream.body?.cancel();
    res.end();
    return;
  }
  Readable.fromWeb(upstream.body).pipe(res);
}

/** Hands everything else to Next.js's own server. */
function proxyToNext(req, res) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const proxied = http.request(
    {
      host: '127.0.0.1',
      port: nextPort,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        'x-forwarded-for': [forwardedFor, req.socket.remoteAddress].filter(Boolean).join(', '),
      },
    },
    (upstream) => {
      res.writeHead(upstream.statusCode ?? 502, {
        ...upstream.headers,
        'x-zephyr-origin': zephyrUrl,
      });
      upstream.pipe(res);
    }
  );
  proxied.on('error', (error) => {
    log('error', 'Next.js request failed', { path: req.url, error: String(error) });
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(proxied);
}

await verifyDeployment();

// Next's server.js reads PORT and HOSTNAME when imported. Keep it private.
// ZEPHYR_URL lets app code show which deployment serves its assets.
process.env.ZEPHYR_URL = zephyrUrl;
process.env.PORT = String(nextPort);
process.env.HOSTNAME = '127.0.0.1';
await import(pathToFileURL(join(here, deployment.serverDir, 'server.js')).href);
await waitForPort(nextPort);

const server = http.createServer((req, res) => {
  const isStatic =
    (req.method === 'GET' || req.method === 'HEAD') && req.url?.startsWith(staticPrefix);
  if (!isStatic) return proxyToNext(req, res);

  serveStatic(req, res).catch((error) => {
    log('error', 'Zephyr asset request failed', { path: req.url, error: String(error) });
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
});
// Load balancers keep idle connections for ~60s; closing sooner causes stray 502s.
server.keepAliveTimeout = 65_000;
server.listen(publicPort, '0.0.0.0', () => {
  log('info', 'ready', { port: publicPort });
});

process.once('SIGTERM', () => server.close());
