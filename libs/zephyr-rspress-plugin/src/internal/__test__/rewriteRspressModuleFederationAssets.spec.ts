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
    await writeFile(
      path.join(outDir, 'remoteEntry.js'),
      '(()=>{__webpack_require__.p = "http://localhost:4178/"})();'
    );
    await writeFile(
      path.join(outDir, 'static/js/index.js'),
      '(()=>{__webpack_require__.p = "http://localhost:4178/"})();'
    );
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
    await expect(
      readFile(path.join(outDir, 'remoteEntry.js'), 'utf8')
    ).resolves.toContain('document.currentScript');
    await expect(
      readFile(path.join(outDir, 'remoteEntry.js'), 'utf8')
    ).resolves.not.toContain('localhost:4178');
    await expect(readFile(path.join(outDir, 'static/js/index.js'), 'utf8')).resolves.toBe(
      '(()=>{__webpack_require__.p="/"})();'
    );

    const browserManifest = JSON.parse(
      await readFile(path.join(outDir, 'mf-manifest.json'), 'utf8')
    );
    expect(browserManifest.metaData).toMatchObject({
      publicPath: 'auto',
      ssrRemoteEntry: {
        name: 'remoteEntry.js',
        path: 'mf-ssg/',
        type: 'commonjs-module',
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
        type: 'commonjs-module',
      },
    });
    expect(ssgManifest.metaData.ssrPublicPath).toBeUndefined();
  });

  it('uses import.meta.url for module remote entry public path rewrites', async () => {
    await writeFile(
      path.join(outDir, 'remoteEntry.js'),
      'export default (()=>{__webpack_require__.p = "http://localhost:4178/"})();'
    );
    await writeFile(
      path.join(outDir, 'mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/',
          remoteEntry: {
            name: 'remoteEntry.js',
            path: '',
            type: 'module',
          },
        },
      })
    );

    await rewriteRspressModuleFederationAssets(outDir, [
      'remoteEntry.js',
      'mf-manifest.json',
    ]);

    await expect(
      readFile(path.join(outDir, 'remoteEntry.js'), 'utf8')
    ).resolves.toContain('import.meta.url');
    await expect(
      readFile(path.join(outDir, 'remoteEntry.js'), 'utf8')
    ).resolves.not.toContain('document.currentScript');
  });

  it('uses manifest path and name to find custom browser remote entries', async () => {
    await mkdir(path.join(outDir, 'assets/mf'), { recursive: true });
    await writeFile(
      path.join(outDir, 'assets/mf/customRemote.js'),
      '(()=>{__webpack_require__.p = "http://localhost:4178/"})();'
    );
    await writeFile(
      path.join(outDir, 'assets/mf/chunk.js'),
      '(()=>{__webpack_require__.p = "http://localhost:4178/"})();'
    );
    await writeFile(
      path.join(outDir, 'mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/',
          remoteEntry: {
            name: 'customRemote.js',
            path: 'assets/mf/',
            type: 'global',
          },
        },
      })
    );

    await rewriteRspressModuleFederationAssets(outDir, [
      'assets/mf/customRemote.js',
      'assets/mf/chunk.js',
      'mf-manifest.json',
    ]);

    await expect(
      readFile(path.join(outDir, 'assets/mf/customRemote.js'), 'utf8')
    ).resolves.toContain('document.currentScript');
    await expect(readFile(path.join(outDir, 'assets/mf/chunk.js'), 'utf8')).resolves.toBe(
      '(()=>{__webpack_require__.p="/"})();'
    );
  });

  it('uses the SSG manifest path and name to find SSR remote entries', async () => {
    await mkdir(path.join(outDir, 'server/nested'), { recursive: true });
    await writeFile(
      path.join(outDir, 'server/nested/ssrRemote.js'),
      'export default (()=>{__webpack_require__.p = "http://localhost:4178/server/"})();'
    );
    await writeFile(
      path.join(outDir, 'server/nested/chunk.js'),
      'export default (()=>{__webpack_require__.p = "http://localhost:4178/server/"})();'
    );
    await writeFile(
      path.join(outDir, 'mf-manifest.json'),
      JSON.stringify({
        metaData: {
          publicPath: 'http://localhost:4178/',
          ssrPublicPath: 'http://localhost:4178/server/',
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
      'server/nested/ssrRemote.js',
      'server/nested/chunk.js',
      'mf-manifest.json',
      'server/mf-manifest.json',
    ]);

    await expect(
      readFile(path.join(outDir, 'server/nested/ssrRemote.js'), 'utf8')
    ).resolves.toContain('import.meta.url');
    await expect(
      readFile(path.join(outDir, 'server/nested/chunk.js'), 'utf8')
    ).resolves.toBe('export default (()=>{__webpack_require__.p="/"})();');
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
        type: 'commonjs-module',
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
        type: 'commonjs-module',
      },
    });
  });
});
