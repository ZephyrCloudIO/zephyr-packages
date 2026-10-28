import { afterEach, describe, expect, it } from '@rstest/core';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { probeHttp } from './probe-http';

const servers: Server[] = [];

async function listen(
  handler: (url: string | undefined) => number | undefined
): Promise<{ origin: string; hits: string[] }> {
  const hits: string[] = [];
  const server = createServer((request, response) => {
    hits.push(request.url ?? '');
    const status = handler(request.url);
    // No status means: accept the request and never answer.
    if (status !== undefined) response.writeHead(status).end('body');
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.closeAllConnections();
          server.close(resolve);
        })
    )
  );
});

describe('probeHttp', () => {
  it('returns the status and body without throwing on 4xx and 5xx', async () => {
    const { origin } = await listen((url) => (url === '/a' ? 401 : 503));

    await expect(probeHttp(new URL('/a', origin), { timeoutMs: 1000 })).resolves.toEqual({
      outcome: 'response',
      status: 401,
      body: 'body',
    });
    await expect(probeHttp(new URL('/b', origin), { timeoutMs: 1000 })).resolves.toEqual({
      outcome: 'response',
      status: 503,
      body: 'body',
    });
  });

  it('does not retry a 503', async () => {
    const { origin, hits } = await listen(() => 503);

    await probeHttp(new URL('/', origin), { timeoutMs: 1000 });

    expect(hits).toEqual(['/']);
  });

  it('reports a closed port as a network error', async () => {
    const { origin } = await listen(() => 200);
    await Promise.all(
      servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))
    );

    await expect(probeHttp(new URL('/', origin), { timeoutMs: 1000 })).resolves.toEqual({
      outcome: 'network_error',
      reason: 'connection refused',
    });
  });

  it('gives up when the server never answers', async () => {
    const { origin } = await listen(() => undefined);
    const started = Date.now();

    await expect(probeHttp(new URL('/', origin), { timeoutMs: 100 })).resolves.toEqual({
      outcome: 'timeout',
    });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('adds the preview api_host hint to gateway requests, like a build does', async () => {
    const { origin, hits } = await listen(() => 200);
    const saved = { ...process.env };
    process.env['ZE_IS_PREVIEW'] = 'true';
    process.env['ZE_API'] = 'http://api.example.test';
    process.env['ZE_API_GATE'] = origin;
    try {
      await probeHttp(new URL('/user-info', origin), { timeoutMs: 1000 });
    } finally {
      process.env = saved;
    }

    expect(hits).toEqual(['/user-info?api_host=http%3A%2F%2Fapi.example.test']);
  });

  it('sends the given headers', async () => {
    let seen: string | undefined;
    const server = createServer((request, response) => {
      seen = request.headers.authorization;
      response.writeHead(200).end();
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    await probeHttp(new URL('/', origin), {
      headers: { Authorization: 'Bearer dummy' },
      timeoutMs: 1000,
    });

    expect(seen).toBe('Bearer dummy');
  });
});
