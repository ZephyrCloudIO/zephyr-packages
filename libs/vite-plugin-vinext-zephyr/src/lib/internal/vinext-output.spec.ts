import { describe, expect, it, rs } from '@rstest/core';

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

rs.mock('zephyr-agent', () => {
  class MockZephyrError extends Error {
    constructor(_code: string, options?: { message?: string }) {
      super(options?.message ?? _code);
    }
  }

  return {
    ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
    ZephyrError: MockZephyrError,
  };
});

import {
  collectStaticClientAssets,
  collectOutputDirectoryAssets,
  collectAssetsFromBundle,
  detectEntrypointFromAssets,
  detectEntrypointFromBundle,
  injectRscAssetsManifest,
  normalizeEntrypoint,
  resolveVinextEntrypoint,
  stripRedundantNodeSideEffectImports,
  type VinextBuildAsset,
  type OutputBundleLike,
} from './vinext-output';

describe('vinext-output helpers', () => {
  it('collects bundle assets using output root relative paths', () => {
    const assets: Record<string, VinextBuildAsset> = {};
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

  it('strips bare node imports from the Worker entry without changing used imports', () => {
    const source = [
      'import "node:fs";',
      "import 'node:path'",
      'import { join } from "node:path";',
      'import "node:crypto";',
      'console.log(join("a", "b"));',
      '',
    ].join('\n');

    expect(stripRedundantNodeSideEffectImports(source)).toBe(
      [
        'import { join } from "node:path";',
        'import "node:crypto";',
        'console.log(join("a", "b"));',
        '',
      ].join('\n')
    );
  });

  it('sanitizes a bundled server entrypoint in memory', () => {
    const assets: Record<string, VinextBuildAsset> = {};
    collectAssetsFromBundle(assets, '/repo/dist', '/repo/dist/server', {
      index: {
        type: 'chunk',
        fileName: 'index.js',
        code: 'import "node:fs";\nexport default {};\n',
      },
    });

    expect(assets['server/index.js']?.content.toString('utf8')).toBe(
      'export default {};\n'
    );
  });

  it('sanitizes minified Worker chunks without changing client assets', () => {
    const assets: Record<string, VinextBuildAsset> = {};
    const emitted =
      'import{x}from"./runtime.js";import"node:fs";import"node:path";export{x};';

    collectAssetsFromBundle(assets, '/repo/dist', '/repo/dist/server', {
      serverChunk: {
        type: 'chunk',
        fileName: '_next/static/instrumentation.js',
        code: emitted,
      },
    });
    collectAssetsFromBundle(assets, '/repo/dist', '/repo/dist/client', {
      clientChunk: {
        type: 'chunk',
        fileName: 'assets/app.js',
        code: emitted,
      },
    });

    expect(
      assets['server/_next/static/instrumentation.js']?.content.toString('utf8')
    ).toBe('import{x}from"./runtime.js";export{x};');
    expect(assets['client/assets/app.js']?.content.toString('utf8')).toBe(emitted);
  });

  it('rejects bundle directories outside the configured output root', () => {
    expect(() =>
      collectAssetsFromBundle({}, '/repo/dist', '/repo/server-output', {
        entry: {
          type: 'chunk',
          fileName: 'index.js',
          code: 'export default {}',
        },
      })
    ).toThrow('outside output root');
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

  it('detects a finalized Wrangler worker entrypoint from collected assets', () => {
    const content = Buffer.from('x');
    expect(
      detectEntrypointFromAssets({
        'worker/wrangler.jsonc': { content, type: 'application/json' },
        'worker/index.mjs': { content, type: 'application/javascript' },
      })
    ).toBe('worker/index.mjs');
  });

  it('normalizes custom entrypoint paths', () => {
    expect(normalizeEntrypoint('/dist/server/index.js')).toBe('server/index.js');
    expect(normalizeEntrypoint('./worker/index.js')).toBe('worker/index.js');
    expect(() => normalizeEntrypoint('../secret.js')).toThrow(
      'inside the output directory'
    );
  });

  it('prefers explicit entrypoint override', () => {
    expect(
      resolveVinextEntrypoint('/repo/dist', 'server/index.js', '/dist/custom/entry.js')
    ).toBe('custom/entry.js');
  });

  it('injects rsc assets manifest for rsc and ssr output directories', () => {
    const assets: Record<string, VinextBuildAsset> = {};

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

  it('collects static client output files for upload', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vinext-zephyr-'));
    try {
      const outputDir = path.join(tempDir, 'dist');
      const clientDir = path.join(outputDir, 'client');

      await fs.mkdir(path.join(clientDir, '.vite'), { recursive: true });
      await fs.mkdir(path.join(clientDir, 'nested'), { recursive: true });
      await fs.writeFile(path.join(clientDir, 'next.svg'), '<svg></svg>', 'utf-8');
      await fs.writeFile(path.join(clientDir, 'nested', 'icon.txt'), 'icon', 'utf-8');
      await fs.writeFile(path.join(clientDir, '_headers'), '/assets/*', 'utf-8');

      const assets: Record<string, VinextBuildAsset> = {};
      await collectStaticClientAssets(assets, outputDir, clientDir);

      expect(Object.keys(assets).sort()).toEqual([
        'client/_headers',
        'client/nested/icon.txt',
        'client/next.svg',
      ]);
      expect(assets['client/next.svg']?.type).toBe('image/svg+xml');
      expect(assets['client/_headers']?.content.toString('utf-8')).toContain('/assets/*');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not overwrite existing bundle assets when collecting static files', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vinext-zephyr-'));
    try {
      const outputDir = path.join(tempDir, 'dist');
      const clientDir = path.join(outputDir, 'client');

      await fs.mkdir(clientDir, { recursive: true });
      await fs.writeFile(path.join(clientDir, 'next.svg'), '<svg>public</svg>', 'utf-8');

      const assets: Record<string, VinextBuildAsset> = {
        'client/next.svg': {
          content: Buffer.from('<svg>bundle</svg>', 'utf-8'),
          type: 'image/svg+xml',
        },
      };

      await collectStaticClientAssets(assets, outputDir, clientDir);

      expect(assets['client/next.svg']?.content.toString('utf-8')).toBe(
        '<svg>bundle</svg>'
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('collects the finalized multi-environment tree and detects CommonJS SSR', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vinext-zephyr-'));
    try {
      const outputDir = path.join(tempDir, 'dist');
      await fs.mkdir(path.join(outputDir, 'client', 'assets'), { recursive: true });
      await fs.mkdir(path.join(outputDir, 'server'), { recursive: true });
      await fs.writeFile(
        path.join(outputDir, 'client', 'assets', 'app.js'),
        'console.log("client")',
        'utf-8'
      );
      await fs.writeFile(
        path.join(outputDir, 'server', 'index.cjs'),
        'module.exports = {}',
        'utf-8'
      );

      const assets: Record<string, VinextBuildAsset> = {};
      await collectOutputDirectoryAssets(assets, outputDir);

      expect(Object.keys(assets).sort()).toEqual([
        'client/assets/app.js',
        'server/index.cjs',
      ]);
      expect(detectEntrypointFromAssets(assets)).toBe('server/index.cjs');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('sanitizes the finalized Worker entry without mutating the emitted file', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vinext-zephyr-'));
    try {
      const outputDir = path.join(tempDir, 'dist');
      const workerPath = path.join(outputDir, 'server', 'index.js');
      const emitted = 'import "node:fs";\nimport "node:path";\nexport default {};\n';
      await fs.mkdir(path.dirname(workerPath), { recursive: true });
      await fs.writeFile(workerPath, emitted, 'utf8');

      const assets: Record<string, VinextBuildAsset> = {};
      await collectOutputDirectoryAssets(assets, outputDir);

      expect(assets['server/index.js']?.content.toString('utf8')).toBe(
        'export default {};\n'
      );
      await expect(fs.readFile(workerPath, 'utf8')).resolves.toBe(emitted);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
