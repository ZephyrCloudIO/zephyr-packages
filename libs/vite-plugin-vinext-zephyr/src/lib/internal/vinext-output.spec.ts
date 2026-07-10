import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

jest.mock('zephyr-agent', () => {
  class MockZephyrError extends Error {}

  return {
    ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
    ZephyrError: MockZephyrError,
  };
});

import {
  collectStaticClientAssets,
  collectAssetsFromBundle,
  detectEntrypointFromBundle,
  injectRscAssetsManifest,
  normalizeEntrypoint,
  resolveVinextEntrypoint,
  sanitizeVinextWorkerEntrypoint,
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

  it('strips redundant node side-effect imports without touching used imports', () => {
    expect(
      stripRedundantNodeSideEffectImports(
        [
          'import "node:fs";',
          'import { join } from "node:path";',
          'console.log(join("a", "b"));',
          '',
        ].join('\n')
      )
    ).toBe(
      ['import { join } from "node:path";', 'console.log(join("a", "b"));', ''].join('\n')
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

  it.each([
    {
      name: 'app-router',
      relativeBundleDir: 'server',
      entryFileName: 'index.js',
      hasWranglerConfig: false,
      overrideEntrypoint: undefined,
      expectedEntrypoint: 'server/index.js',
      expectedAssetPaths: ['server/index.js'],
    },
    {
      name: 'pages-router',
      relativeBundleDir: 'worker-build',
      entryFileName: 'index.js',
      hasWranglerConfig: true,
      overrideEntrypoint: undefined,
      expectedEntrypoint: 'worker-build/index.js',
      expectedAssetPaths: ['worker-build/index.js', 'worker-build/wrangler.json'],
    },
    {
      name: 'custom override',
      relativeBundleDir: 'custom',
      entryFileName: 'entry.js',
      hasWranglerConfig: false,
      overrideEntrypoint: '/dist/custom/entry.js',
      expectedEntrypoint: 'custom/entry.js',
      expectedAssetPaths: ['custom/entry.js', 'server/index.js'],
    },
  ])(
    'sanitizes the selected $name entrypoint in uploaded assets and on disk',
    async ({
      relativeBundleDir,
      entryFileName,
      hasWranglerConfig,
      overrideEntrypoint,
      expectedEntrypoint,
      expectedAssetPaths,
    }) => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vinext-zephyr-'));
      const originalCode = [
        'import "node:fs";',
        'import "node:path";',
        'export default {};',
        '',
      ].join('\n');

      try {
        const outputDir = path.join(tempDir, 'dist');
        const assets: Record<string, VinextBuildAsset> = {};
        let detectedEntrypoint: string | undefined;

        if (overrideEntrypoint) {
          const serverBundle: OutputBundleLike = {
            index: { type: 'chunk', fileName: 'index.js', code: originalCode },
          };
          const serverBundleDir = path.join(outputDir, 'server');

          collectAssetsFromBundle(assets, outputDir, serverBundleDir, serverBundle);
          detectedEntrypoint = detectEntrypointFromBundle(
            outputDir,
            serverBundleDir,
            serverBundle
          );
        }

        const bundle: OutputBundleLike = {
          entry: {
            type: 'chunk',
            fileName: entryFileName,
            code: originalCode,
          },
        };
        if (hasWranglerConfig) {
          bundle.wrangler = {
            type: 'asset',
            fileName: 'wrangler.json',
            source: '{}',
          };
        }

        const bundleDir = path.join(outputDir, relativeBundleDir);
        collectAssetsFromBundle(assets, outputDir, bundleDir, bundle);
        detectedEntrypoint = detectEntrypointFromBundle(
          outputDir,
          bundleDir,
          bundle,
          detectedEntrypoint
        );

        const selectedEntrypoint = resolveVinextEntrypoint(
          outputDir,
          detectedEntrypoint,
          overrideEntrypoint
        );
        expect(selectedEntrypoint).toBe(expectedEntrypoint);
        expect(Object.keys(assets).sort()).toEqual([...expectedAssetPaths].sort());

        const selectedEntrypointPath = path.join(outputDir, selectedEntrypoint);
        await fs.mkdir(path.dirname(selectedEntrypointPath), { recursive: true });
        await fs.writeFile(selectedEntrypointPath, originalCode, 'utf-8');

        const nonSelectedEntrypoint = overrideEntrypoint ? 'server/index.js' : undefined;
        if (nonSelectedEntrypoint) {
          const nonSelectedEntrypointPath = path.join(outputDir, nonSelectedEntrypoint);
          await fs.mkdir(path.dirname(nonSelectedEntrypointPath), {
            recursive: true,
          });
          await fs.writeFile(nonSelectedEntrypointPath, originalCode, 'utf-8');
        }

        await sanitizeVinextWorkerEntrypoint(assets, outputDir, selectedEntrypoint);

        expect(assets[selectedEntrypoint]?.content.toString('utf-8')).toBe(
          'export default {};\n'
        );
        await expect(fs.readFile(selectedEntrypointPath, 'utf-8')).resolves.toBe(
          'export default {};\n'
        );

        if (nonSelectedEntrypoint) {
          expect(assets[nonSelectedEntrypoint]?.content.toString('utf-8')).toBe(
            originalCode
          );
          await expect(
            fs.readFile(path.join(outputDir, nonSelectedEntrypoint), 'utf-8')
          ).resolves.toBe(originalCode);
        }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  );
});
