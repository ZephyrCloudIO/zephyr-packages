import { describe, expect, it, rs } from '@rstest/core';
import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../zephyr-engine';
import { warnPathModeAbsoluteUrls } from './warn-path-mode-absolute-urls';

function createEngine(
  addressMode: 'hostname' | 'path' | undefined,
  logger = rs.fn(),
  environmentAddressMode?: 'hostname' | 'path'
): { engine: ZephyrEngine; logger: ReturnType<typeof rs.fn> } {
  return {
    engine: {
      application_configuration: Promise.resolve({
        ADDRESS_MODE: addressMode,
        ENVIRONMENTS: environmentAddressMode
          ? { preview: { addressMode: environmentAddressMode } }
          : undefined,
      }),
      logger: Promise.resolve(logger),
    } as unknown as ZephyrEngine,
    logger,
  };
}

function htmlAsset(path: string, html: string | Buffer): ZeBuildAssetsMap[string] {
  return {
    path,
    extname: '.html',
    hash: `hash-${path}`,
    size: html.length,
    buffer: html,
  };
}

describe('warnPathModeAbsoluteUrls', () => {
  it('warns for origin-absolute src and href attributes', async () => {
    const { engine, logger } = createEngine('path');
    await warnPathModeAbsoluteUrls(engine, {
      html: htmlAsset(
        'index.html',
        Buffer.from(
          '<script src="/assets/index.js"></script><link href="/assets/index.css">'
        )
      ),
    });

    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger.mock.calls[0]?.[0]).toMatchObject({
      level: 'warn',
      action: 'build:warn:path-mode-absolute-urls',
    });
    expect(logger.mock.calls[0]?.[0]?.message).toContain(
      'index.html: src="/assets/index.js"'
    );
    expect(logger.mock.calls[0]?.[0]?.message).toContain(
      'index.html: href="/assets/index.css"'
    );
  });

  it('also warns when only a secondary environment uses path addressing', async () => {
    const { engine, logger } = createEngine('hostname', rs.fn(), 'path');
    await warnPathModeAbsoluteUrls(engine, {
      html: htmlAsset('index.html', '<img src="/logo.svg">'),
    });

    expect(logger).toHaveBeenCalledTimes(1);
  });

  it('ignores relative, full, protocol-relative, and inline-text lookalikes', async () => {
    const { engine, logger } = createEngine('path');
    await warnPathModeAbsoluteUrls(engine, {
      html: htmlAsset(
        'index.html',
        [
          '<script src="./assets/app.js"></script>',
          '<link href="//cdn.example.test/app.css">',
          '<img src="https://cdn.example.test/logo.svg">',
          '<script>const template = `src="/not-an-attribute.js"`;</script>',
        ].join('')
      ),
    });

    expect(logger).not.toHaveBeenCalled();
  });

  it('caps retained findings while reporting the full count', async () => {
    const { engine, logger } = createEngine('path');
    const links = Array.from(
      { length: 12 },
      (_, index) => `<link href="/assets/chunk-${index}.css">`
    ).join('');
    await warnPathModeAbsoluteUrls(engine, {
      html: htmlAsset('index.html', links),
    });

    expect(logger.mock.calls[0]?.[0]?.message).toContain('...and 2 more');
  });

  it('does not warn for hostname-only builds or non-HTML assets', async () => {
    const { engine, logger } = createEngine('hostname');
    await warnPathModeAbsoluteUrls(engine, {
      html: htmlAsset('index.html', '<script src="/assets/app.js"></script>'),
      script: {
        path: 'app.js',
        extname: '.js',
        hash: 'script',
        size: 20,
        buffer: 'const src="/api"',
      },
    });

    expect(logger).not.toHaveBeenCalled();
  });

  it('never rejects when configuration lookup fails', async () => {
    const engine = {
      application_configuration: Promise.reject(new Error('offline')),
      logger: Promise.resolve(rs.fn()),
    } as unknown as ZephyrEngine;

    await expect(warnPathModeAbsoluteUrls(engine, {})).resolves.toBeUndefined();
  });
});
