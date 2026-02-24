import {
  collectAssetsFromBundle,
  detectEntrypointFromBundle,
  injectRscAssetsManifest,
  normalizeEntrypoint,
  resolveVinextEntrypoint,
  type OutputBundleLike,
} from './vinext-output';

describe('vinext-output helpers', () => {
  it('collects bundle assets using output root relative paths', () => {
    const assets = {};
    const bundle: OutputBundleLike = {
      entry: {
        type: 'chunk',
        fileName: 'assets/app.js',
        code: 'console.log(1)',
      },
      styles: {
        type: 'asset',
        fileName: 'assets/app.css',
        source: 'body{}',
      },
    };

    collectAssetsFromBundle(assets, '/repo/dist', '/repo/dist/client', bundle);

    expect(Object.keys(assets).sort()).toEqual([
      'client/assets/app.css',
      'client/assets/app.js',
    ]);
    expect(assets['client/assets/app.js']?.type).toBe('application/javascript');
    expect(assets['client/assets/app.css']?.type).toBe('text/css');
  });

  it('detects app-router entrypoint from server bundle', () => {
    const bundle: OutputBundleLike = {
      index: {
        type: 'chunk',
        fileName: 'index.js',
        code: 'export default {}',
      },
    };

    const entrypoint = detectEntrypointFromBundle(
      '/repo/dist',
      '/repo/dist/server',
      bundle
    );

    expect(entrypoint).toBe('server/index.js');
  });

  it('detects pages-router entrypoint from worker bundle metadata', () => {
    const bundle: OutputBundleLike = {
      index: {
        type: 'chunk',
        fileName: 'index.js',
        code: 'export default {}',
      },
      wrangler: {
        type: 'asset',
        fileName: 'wrangler.json',
        source: '{}',
      },
    };

    const entrypoint = detectEntrypointFromBundle(
      '/repo/dist',
      '/repo/dist/worker-build',
      bundle
    );

    expect(entrypoint).toBe('worker-build/index.js');
  });

  it('normalizes custom entrypoint paths', () => {
    expect(normalizeEntrypoint('/dist/server/index.js')).toBe('server/index.js');
    expect(normalizeEntrypoint('./worker/index.js')).toBe('worker/index.js');
  });

  it('prefers explicit entrypoint override', () => {
    expect(
      resolveVinextEntrypoint('/repo/dist', 'server/index.js', '/dist/custom/entry.js')
    ).toBe('custom/entry.js');
  });

  it('injects rsc assets manifest for rsc and ssr output directories', () => {
    const assets = {};

    injectRscAssetsManifest(assets, '/repo/dist', {
      buildAssetsManifest: {
        bootstrapScriptContent: 'import("/assets/index.js")',
        clientReferenceDeps: {},
      },
      config: {
        environments: {
          rsc: { build: { outDir: '/repo/dist/server' } },
          ssr: { build: { outDir: '/repo/dist/server/ssr' } },
        },
      },
    });

    expect(Object.keys(assets).sort()).toEqual([
      'server/__vite_rsc_assets_manifest.js',
      'server/ssr/__vite_rsc_assets_manifest.js',
    ]);
    expect(
      assets['server/__vite_rsc_assets_manifest.js']?.content.toString('utf-8')
    ).toContain('bootstrapScriptContent');
    expect(assets['server/__vite_rsc_assets_manifest.js']?.type).toBe(
      'application/javascript'
    );
  });
});
