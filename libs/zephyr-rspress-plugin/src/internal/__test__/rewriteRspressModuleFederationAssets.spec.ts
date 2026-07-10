import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rewriteRspressModuleFederationAssets } from '../assets/rewriteRspressModuleFederationAssets';

interface TestManifest {
  metaData: {
    publicPath?: string;
    getPublicPath?: string;
    ssrPublicPath?: string;
    remoteEntry?: { name?: string; path?: string; type?: string };
    ssrRemoteEntry?: { name?: string; path?: string; type?: string };
  };
}

describe('rewriteRspressModuleFederationAssets', () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'zephyr-rspress-mf-'));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  async function write(relativePath: string, content: string): Promise<void> {
    const destination = path.join(outDir, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }

  async function json(relativePath: string): Promise<TestManifest> {
    return JSON.parse(
      await readFile(path.join(outDir, relativePath), 'utf8')
    ) as TestManifest;
  }

  it('does nothing when the build is not a Module Federation remote', async () => {
    const html = '<link href="https://cdn.example.test/static/app.css">';
    await write('index.html', html);

    await rewriteRspressModuleFederationAssets(outDir, ['index.html']);

    await expect(readFile(path.join(outDir, 'index.html'), 'utf8')).resolves.toBe(html);
  });

  it('makes emitted HTML and dual manifests portable without rewriting JS text', async () => {
    await write(
      'index.html',
      [
        '<link href="http://localhost:4178/static/css/styles.css">',
        '<script src="http://localhost:4178/static/js/index.js"></script>',
        '<pre>http://localhost:4178/static/js/example.js</pre>',
      ].join('')
    );
    await write(
      'zh/vite.html',
      '<script src="http://localhost:4178/static/js/index.js"></script>'
    );
    const runtime = '(()=>{__webpack_require__.p="http://localhost:4178/"})();';
    await write('static/js/index.js', runtime);
    await write('static/css/styles.css', 'body{}');
    await write(
      'mf-manifest.json',
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/',
          ssrPublicPath: 'http://localhost:4178/mf-ssg/',
          remoteEntry: { name: 'remoteEntry.js', path: '', type: 'global' },
          ssrRemoteEntry: { name: 'remoteEntry.js', path: '', type: 'module' },
        },
      })
    );
    await write(
      'mf-ssg/mf-manifest.json',
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/mf-ssg/',
          remoteEntry: { name: 'remoteEntry.js', path: '', type: 'module' },
        },
      })
    );
    const files = [
      'index.html',
      'zh/vite.html',
      'static/js/index.js',
      'static/css/styles.css',
      'mf-manifest.json',
      'mf-ssg/mf-manifest.json',
    ];

    await rewriteRspressModuleFederationAssets(outDir, files);

    await expect(readFile(path.join(outDir, 'index.html'), 'utf8')).resolves.toBe(
      [
        '<link href="./static/css/styles.css">',
        '<script src="./static/js/index.js"></script>',
        '<pre>http://localhost:4178/static/js/example.js</pre>',
      ].join('')
    );
    await expect(readFile(path.join(outDir, 'zh/vite.html'), 'utf8')).resolves.toBe(
      '<script src="../static/js/index.js"></script>'
    );
    await expect(readFile(path.join(outDir, 'static/js/index.js'), 'utf8')).resolves.toBe(
      runtime
    );

    const browser = await json('mf-manifest.json');
    expect(browser.metaData).toMatchObject({
      publicPath: 'auto',
      ssrRemoteEntry: { name: 'remoteEntry.js', path: 'mf-ssg/', type: 'module' },
    });
    expect(browser.metaData.ssrPublicPath).toBeUndefined();
    const ssg = await json('mf-ssg/mf-manifest.json');
    expect(ssg.metaData.publicPath).toBe('auto');
  });

  it('preserves explicit getPublicPath semantics instead of shadowing it', async () => {
    const getPublicPath = 'return "https://cdn.example.test/"';
    await write('index.html', '<script src="https://build.test/static/app.js"></script>');
    await write('static/app.js', 'export {}');
    await write('mf-manifest.json', JSON.stringify({ metaData: { getPublicPath } }));

    await rewriteRspressModuleFederationAssets(outDir, [
      'index.html',
      'static/app.js',
      'mf-manifest.json',
    ]);

    const manifest = await json('mf-manifest.json');
    expect(manifest.metaData.getPublicPath).toBe(getPublicPath);
    expect(manifest.metaData.publicPath).toBeUndefined();
  });

  it('uses the emitted nested manifest and remote entry subpath', async () => {
    await write(
      'mf-manifest.json',
      JSON.stringify({
        metaData: {
          publicPath: 'https://cdn.example.test/docs/',
          ssrPublicPath: 'https://cdn.example.test/docs/server/',
          ssrRemoteEntry: { name: 'ssrRemote.js', path: '', type: 'module' },
        },
      })
    );
    await write(
      'server/mf-manifest.json',
      JSON.stringify({
        metaData: {
          publicPath: 'https://cdn.example.test/docs/server/',
          remoteEntry: { name: 'ssrRemote.js', path: 'nested/', type: 'module' },
        },
      })
    );

    await rewriteRspressModuleFederationAssets(outDir, [
      'mf-manifest.json',
      'server/mf-manifest.json',
    ]);

    expect((await json('mf-manifest.json')).metaData.ssrRemoteEntry).toEqual({
      name: 'ssrRemote.js',
      path: 'server/nested/',
      type: 'module',
    });
  });

  it('does not rewrite third-party assets which were not emitted', async () => {
    const html = [
      '<script src="https://cdn.vendor.test/static/widget.js"></script>',
      '<script src="https://build.test/static/app.js"></script>',
    ].join('');
    await write('index.html', html);
    await write('static/app.js', 'export {}');
    await write(
      'mf-manifest.json',
      JSON.stringify({ metaData: { publicPath: 'https://build.test/' } })
    );

    await rewriteRspressModuleFederationAssets(outDir, [
      'index.html',
      'static/app.js',
      'mf-manifest.json',
    ]);

    await expect(readFile(path.join(outDir, 'index.html'), 'utf8')).resolves.toBe(
      [
        '<script src="https://cdn.vendor.test/static/widget.js"></script>',
        '<script src="./static/app.js"></script>',
      ].join('')
    );
  });

  it('fails closed when several SSG manifests are ambiguous', async () => {
    await write('mf-manifest.json', JSON.stringify({ metaData: { publicPath: 'auto' } }));
    await write(
      'a/mf-manifest.json',
      JSON.stringify({ metaData: { remoteEntry: { name: 'a.js' } } })
    );
    await write(
      'b/mf-manifest.json',
      JSON.stringify({ metaData: { remoteEntry: { name: 'b.js' } } })
    );

    await expect(
      rewriteRspressModuleFederationAssets(outDir, [
        'mf-manifest.json',
        'a/mf-manifest.json',
        'b/mf-manifest.json',
      ])
    ).rejects.toThrow('ambiguous');
  });

  it('rejects output paths which escape the build root', async () => {
    await write('mf-manifest.json', JSON.stringify({ metaData: { publicPath: 'auto' } }));

    await expect(
      rewriteRspressModuleFederationAssets(outDir, [
        'mf-manifest.json',
        '../outside.html',
      ])
    ).rejects.toThrow('Invalid Rspress output file path');
  });
});
