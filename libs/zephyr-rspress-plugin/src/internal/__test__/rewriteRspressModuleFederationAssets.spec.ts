import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rewriteRspressModuleFederationAssets } from '../assets/rewriteRspressModuleFederationAssets';

describe('rewriteRspressModuleFederationAssets', () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'zephyr-rspress-mf-'));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it('does nothing when the build is not a module federation remote', async () => {
    const htmlPath = path.join(outDir, 'index.html');
    const html = '<link rel="stylesheet" href="https://cdn.example.com/static/app.css">';
    await writeFile(htmlPath, html);

    await rewriteRspressModuleFederationAssets(outDir, ['index.html']);

    await expect(readFile(htmlPath, 'utf8')).resolves.toBe(html);
  });

  it('rewrites rspress module federation output for Zephyr immutable URLs', async () => {
    await mkdir(path.join(outDir, 'zh'), { recursive: true });
    await mkdir(path.join(outDir, 'mf-ssg'), { recursive: true });

    await writeFile(
      path.join(outDir, 'index.html'),
      [
        '<link rel="stylesheet" href="http://localhost:4178/static/css/styles.css">',
        '<script src="http://localhost:4178/static/js/index.js"></script>',
        '<pre>http://localhost:4178/static/js/example.js</pre>',
      ].join('')
    );
    await mkdir(path.join(outDir, 'static/js'), { recursive: true });
    const remoteEntrySource =
      '(()=>{__webpack_require__.p = "http://localhost:4178/"})();';
    const chunkSource = '(()=>{__webpack_require__.p = "http://localhost:4178/"})();';
    await writeFile(path.join(outDir, 'remoteEntry.js'), remoteEntrySource);
    await writeFile(path.join(outDir, 'static/js/index.js'), chunkSource);
    await writeFile(
      path.join(outDir, 'zh/vite.html'),
      '<script src="http://localhost:4178/static/js/zh.js"></script>'
    );
    await writeFile(
      path.join(outDir, 'mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/',
          ssrPublicPath: 'http://localhost:4178/mf-ssg/',
          remoteEntry: {
            name: 'remoteEntry.js',
            path: '',
            type: 'global',
          },
          ssrRemoteEntry: {
            name: 'remoteEntry.js',
            path: '',
            type: 'module',
          },
        },
      })
    );
    await writeFile(
      path.join(outDir, 'mf-ssg/mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/mf-ssg/',
          remoteEntry: {
            name: 'remoteEntry.js',
            path: '',
            type: 'module',
          },
        },
      })
    );

    await rewriteRspressModuleFederationAssets(outDir, [
      'index.html',
      'zh/vite.html',
      'remoteEntry.js',
      'static/js/index.js',
      'mf-manifest.json',
      'mf-ssg/mf-manifest.json',
    ]);

    await expect(readFile(path.join(outDir, 'index.html'), 'utf8')).resolves.toBe(
      [
        '<link rel="stylesheet" href="/static/css/styles.css">',
        '<script src="/static/js/index.js"></script>',
        '<pre>http://localhost:4178/static/js/example.js</pre>',
      ].join('')
    );
    await expect(readFile(path.join(outDir, 'zh/vite.html'), 'utf8')).resolves.toBe(
      '<script src="/static/js/zh.js"></script>'
    );
    await expect(readFile(path.join(outDir, 'remoteEntry.js'), 'utf8')).resolves.toBe(
      remoteEntrySource
    );
    await expect(readFile(path.join(outDir, 'static/js/index.js'), 'utf8')).resolves.toBe(
      chunkSource
    );

    const browserManifest = JSON.parse(
      await readFile(path.join(outDir, 'mf-manifest.json'), 'utf8')
    );
    expect(browserManifest.metaData).toMatchObject({
      publicPath: 'auto',
      ssrRemoteEntry: {
        name: 'remoteEntry.js',
        path: 'mf-ssg/',
        type: 'module',
      },
    });
    expect(browserManifest.metaData.ssrPublicPath).toBeUndefined();

    const ssgManifest = JSON.parse(
      await readFile(path.join(outDir, 'mf-ssg/mf-manifest.json'), 'utf8')
    );
    expect(ssgManifest.metaData).toMatchObject({
      publicPath: 'auto',
      remoteEntry: {
        name: 'remoteEntry.js',
        path: '',
        type: 'module',
      },
    });
    expect(ssgManifest.metaData.ssrPublicPath).toBeUndefined();
  });

  it('uses the SSG manifest path and name to find SSR remote entries', async () => {
    await mkdir(path.join(outDir, 'server/nested'), { recursive: true });
    await writeFile(
      path.join(outDir, 'mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/',
          ssrPublicPath: 'http://localhost:4178/server/',
          ssrRemoteEntry: {
            name: 'ssrRemote.js',
            path: '',
            type: 'module',
          },
        },
      })
    );
    await writeFile(
      path.join(outDir, 'server/mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/server/',
          remoteEntry: {
            name: 'ssrRemote.js',
            path: 'nested/',
            type: 'module',
          },
        },
      })
    );

    await rewriteRspressModuleFederationAssets(outDir, [
      'mf-manifest.json',
      'server/mf-manifest.json',
    ]);

    const browserManifest = JSON.parse(
      await readFile(path.join(outDir, 'mf-manifest.json'), 'utf8')
    );
    expect(browserManifest.metaData.ssrRemoteEntry).toMatchObject({
      name: 'ssrRemote.js',
      path: 'server/nested/',
      type: 'module',
    });
  });

  it('rewrites absolute Rspress HTML asset URLs when manifest uses getPublicPath', async () => {
    await writeFile(
      path.join(outDir, 'index.html'),
      [
        '<link href="http://localhost:4178/static/css/styles.css" rel="stylesheet">',
        '<script defer src="http://localhost:4178/static/js/index.js"></script>',
        '<script defer src="https://cdn.vendor.com/static/widget.js"></script>',
        '<a href="http://localhost:4178/static/reference">Reference</a>',
      ].join('')
    );
    await writeFile(
      path.join(outDir, 'mf-manifest.json'),
      JSON.stringify({
        metaData: {
          getPublicPath: 'return "http://localhost:4178/"',
        },
      })
    );

    await rewriteRspressModuleFederationAssets(outDir, [
      'index.html',
      'mf-manifest.json',
      'static/css/styles.css',
      'static/js/index.js',
    ]);

    await expect(readFile(path.join(outDir, 'index.html'), 'utf8')).resolves.toBe(
      [
        '<link href="/static/css/styles.css" rel="stylesheet">',
        '<script defer src="/static/js/index.js"></script>',
        '<script defer src="https://cdn.vendor.com/static/widget.js"></script>',
        '<a href="http://localhost:4178/static/reference">Reference</a>',
      ].join('')
    );
  });

  it('preserves custom SSR output paths from the emitted manifest', async () => {
    await mkdir(path.join(outDir, 'server'), { recursive: true });
    await writeFile(
      path.join(outDir, 'mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/',
          ssrPublicPath: 'http://localhost:4178/server/',
          ssrRemoteEntry: {
            name: 'remoteEntry.js',
            path: '',
            type: 'module',
          },
        },
      })
    );
    await writeFile(
      path.join(outDir, 'server/mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/server/',
          remoteEntry: {
            name: 'remoteEntry.js',
            path: '',
            type: 'module',
          },
        },
      })
    );

    await rewriteRspressModuleFederationAssets(outDir, [
      'mf-manifest.json',
      'server/mf-manifest.json',
    ]);

    const browserManifest = JSON.parse(
      await readFile(path.join(outDir, 'mf-manifest.json'), 'utf8')
    );
    expect(browserManifest.metaData).toMatchObject({
      publicPath: 'auto',
      ssrRemoteEntry: {
        name: 'remoteEntry.js',
        path: 'server/',
        type: 'module',
      },
    });

    const ssgManifest = JSON.parse(
      await readFile(path.join(outDir, 'server/mf-manifest.json'), 'utf8')
    );
    expect(ssgManifest.metaData).toMatchObject({
      publicPath: 'auto',
      remoteEntry: {
        name: 'remoteEntry.js',
        path: '',
        type: 'module',
      },
    });
  });

  it('prefers discovered SSG manifest directories over URL public path prefixes', async () => {
    await mkdir(path.join(outDir, 'mf-ssg'), { recursive: true });
    await writeFile(
      path.join(outDir, 'mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'https://cdn.example.com/docs/',
          ssrPublicPath: 'https://cdn.example.com/docs/mf-ssg/',
          ssrRemoteEntry: {
            name: 'remoteEntry.js',
            path: '',
            type: 'module',
          },
        },
      })
    );
    await writeFile(
      path.join(outDir, 'mf-ssg/mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'https://cdn.example.com/docs/mf-ssg/',
          remoteEntry: {
            name: 'remoteEntry.js',
            path: '',
            type: 'module',
          },
        },
      })
    );

    await rewriteRspressModuleFederationAssets(outDir, [
      'mf-manifest.json',
      'mf-ssg/mf-manifest.json',
    ]);

    const browserManifest = JSON.parse(
      await readFile(path.join(outDir, 'mf-manifest.json'), 'utf8')
    );
    expect(browserManifest.metaData.ssrRemoteEntry).toMatchObject({
      name: 'remoteEntry.js',
      path: 'mf-ssg/',
      type: 'module',
    });
  });
});
