import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../zephyr-engine';
import { warnPathModeAbsoluteUrls } from './warn-path-mode-absolute-urls';

function createEngine(addressMode: string | undefined, logger: jest.Mock): ZephyrEngine {
  return {
    application_configuration: Promise.resolve({ ADDRESS_MODE: addressMode }),
    logger: Promise.resolve(logger),
  } as unknown as ZephyrEngine;
}

function createHtmlAsset(path: string, html: string): ZeBuildAssetsMap[string] {
  return { path, extname: '.html', hash: 'hash', size: html.length, buffer: html };
}

describe('warnPathModeAbsoluteUrls', () => {
  it('warns about origin-absolute src and href URLs in HTML assets', async () => {
    const logger = jest.fn();
    const assetsMap: ZeBuildAssetsMap = {
      a: createHtmlAsset(
        'index.html',
        '<script src="/assets/index-abc.js"></script><link href="/assets/index.css">'
      ),
    };

    await warnPathModeAbsoluteUrls(createEngine('path', logger), assetsMap);

    expect(logger).toHaveBeenCalledTimes(1);
    const { level, message } = logger.mock.calls[0][0];
    expect(level).toBe('warn');
    expect(message).toContain('index.html: src="/assets/index-abc.js"');
    expect(message).toContain('index.html: href="/assets/index.css"');
  });

  it('does not warn for relative or protocol-relative URLs', async () => {
    const logger = jest.fn();
    const assetsMap: ZeBuildAssetsMap = {
      a: createHtmlAsset(
        'index.html',
        '<script src="./assets/app.js"></script><link href="//cdn.example.com/x.css"><img src="https://example.com/logo.png">'
      ),
    };

    await warnPathModeAbsoluteUrls(createEngine('path', logger), assetsMap);

    expect(logger).not.toHaveBeenCalled();
  });

  it('does nothing for hostname-addressed applications', async () => {
    const logger = jest.fn();
    const assetsMap: ZeBuildAssetsMap = {
      a: createHtmlAsset('index.html', '<script src="/assets/app.js"></script>'),
    };

    await warnPathModeAbsoluteUrls(createEngine('hostname', logger), assetsMap);

    expect(logger).not.toHaveBeenCalled();
  });

  it('ignores non-HTML assets', async () => {
    const logger = jest.fn();
    const assetsMap: ZeBuildAssetsMap = {
      a: {
        path: 'assets/app.js',
        extname: '.js',
        hash: 'hash',
        size: 10,
        buffer: 'fetch("/api/data")',
      },
    };

    await warnPathModeAbsoluteUrls(createEngine('path', logger), assetsMap);

    expect(logger).not.toHaveBeenCalled();
  });

  it('caps the reported URL list and mentions the remainder', async () => {
    const logger = jest.fn();
    const links = Array.from(
      { length: 12 },
      (_, i) => `<link href="/assets/chunk-${i}.css">`
    ).join('');
    const assetsMap: ZeBuildAssetsMap = {
      a: createHtmlAsset('index.html', links),
    };

    await warnPathModeAbsoluteUrls(createEngine('path', logger), assetsMap);

    const { message } = logger.mock.calls[0][0];
    expect(message).toContain('...and 2 more');
  });

  it('never throws when the configuration lookup fails', async () => {
    const logger = jest.fn();
    const engine = {
      application_configuration: Promise.reject(new Error('offline')),
      logger: Promise.resolve(logger),
    } as unknown as ZephyrEngine;

    await expect(warnPathModeAbsoluteUrls(engine, {})).resolves.toBeUndefined();
    expect(logger).not.toHaveBeenCalled();
  });
});
