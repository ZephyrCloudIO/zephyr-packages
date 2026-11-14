import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@rstest/core';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ZeResolvedDependency } from 'zephyr-agent';

import { downloadEmbeddedRemotes } from './embed-remotes';

type Route = { status?: number; body: string };

const routes = new Map<string, Route>();
const hits: string[] = [];
let server: http.Server;
let origin = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const requestPath = req.url ?? '';
    hits.push(requestPath);
    const route = routes.get(requestPath);
    res.statusCode = route ? (route.status ?? 200) : 404;
    res.end(route?.body ?? '');
  });
  const listening = Promise.withResolvers<void>();
  server.listen(0, '127.0.0.1', listening.resolve);
  await listening.promise;
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  const closed = Promise.withResolvers<void>();
  server.close(() => closed.resolve());
  await closed.promise;
});

beforeEach(() => {
  routes.clear();
  hits.length = 0;
});

function dependency(name: string, manifestPath?: string): ZeResolvedDependency {
  return {
    name,
    version: 'latest',
    application_uid: `${name}.p.o`,
    default_url: `${origin}/${name}/`,
    remote_entry_url: `${name}@${origin}/${name}/remoteEntry.bundle`,
    manifest_url: manifestPath ? `${origin}${manifestPath}` : undefined,
    library_type: 'var',
  };
}

function serveMetroRemote(name: string): void {
  routes.set(`/${name}/mf-manifest.json`, {
    body: JSON.stringify({
      metaData: {
        publicPath: 'auto',
        remoteEntry: { name: 'remoteEntry.bundle', path: '' },
      },
      exposes: [{ name: 'Card' }],
      shared: [{ assets: { js: { sync: ['shared/lodash.js'] } } }],
    }),
  });
  routes.set(`/${name}/remoteEntry.bundle`, { body: 'container' });
  routes.set(`/${name}/exposed/Card.bundle`, { body: 'card' });
  routes.set(`/${name}/shared/lodash.bundle`, { body: 'lodash' });
}

describe('downloadEmbeddedRemotes', () => {
  it('downloads the Metro container, exposes, and shared bundles', async () => {
    serveMetroRemote('cart');

    const [remote] = await downloadEmbeddedRemotes({
      declared: ['cart'],
      resolved: [dependency('cart', '/cart/mf-manifest.json')],
      exclude: [],
      bundler: 'metro',
    });

    expect(Object.keys(remote?.runtime.files ?? {}).sort()).toEqual([
      'exposed/Card.bundle',
      'remoteEntry.bundle',
      'shared/lodash.bundle',
    ]);
    for (const fileName of Object.values(remote?.runtime.files ?? {})) {
      expect(fileName).toMatch(/^zephyr-remote-[0-9a-f]{16}-/);
    }
    const contents = Object.fromEntries(
      (remote?.files ?? []).map(({ fileName, content }) => [fileName, content.toString()])
    );
    expect(contents[remote?.runtime.files['exposed/Card.bundle'] ?? '']).toBe('card');
    expect(remote?.runtime.manifestUrl).toBe(`${origin}/cart/mf-manifest.json`);
  });

  it('names the remote and the HTTP status when a file is missing', async () => {
    serveMetroRemote('cart');
    routes.delete('/cart/exposed/Card.bundle');

    const download = downloadEmbeddedRemotes({
      declared: ['cart'],
      resolved: [dependency('cart', '/cart/mf-manifest.json')],
      exclude: [],
      bundler: 'metro',
    });

    await expect(download).rejects.toThrow(/remote "cart".*HTTP 404/);
  });

  it('fails for a declared remote that did not resolve', async () => {
    await expect(
      downloadEmbeddedRemotes({
        declared: ['cart'],
        resolved: [],
        exclude: [],
        bundler: 'metro',
      })
    ).rejects.toThrow(/remote "cart" did not resolve/);
  });

  it('does not request excluded remotes', async () => {
    serveMetroRemote('cart');
    serveMetroRemote('analytics');

    const remotes = await downloadEmbeddedRemotes({
      declared: ['cart', 'analytics'],
      resolved: [
        dependency('cart', '/cart/mf-manifest.json'),
        dependency('analytics', '/analytics/mf-manifest.json'),
      ],
      exclude: ['analytics'],
      bundler: 'metro',
    });

    expect(remotes.map((remote) => remote.runtime.name)).toEqual(['cart']);
    expect(hits.some((hit) => hit.startsWith('/analytics/'))).toBe(false);
  });

  it('rejects Re.Pack files that share a basename', async () => {
    routes.set('/mini/mf-manifest.json', {
      body: JSON.stringify({
        metaData: {
          publicPath: 'auto',
          remoteEntry: { name: 'mini.container.js.bundle', path: '' },
        },
        exposes: [
          { name: 'App', assets: { js: { sync: ['a/chunk.bundle'], async: [] } } },
        ],
        shared: [{ assets: { js: { sync: ['b/chunk.bundle'], async: [] } } }],
      }),
    });

    await expect(
      downloadEmbeddedRemotes({
        declared: ['mini'],
        resolved: [dependency('mini')],
        exclude: [],
        bundler: 'repack',
      })
    ).rejects.toThrow(/files "a\/chunk.bundle" and "b\/chunk.bundle" share a name/);
  });
});
