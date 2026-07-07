import type { ZephyrEngine } from 'zephyr-agent';
import type { XPackConfiguration } from '../src/xpack.types';
import { mutPathModePublicPath } from '../src/xpack-extract/mut-path-mode-public-path';

function createEngine(addressMode?: string): ZephyrEngine {
  return {
    application_configuration: Promise.resolve({ ADDRESS_MODE: addressMode }),
  } as unknown as ZephyrEngine;
}

describe('mutPathModePublicPath', () => {
  it('overrides an origin-absolute publicPath to auto for path-addressed apps', async () => {
    const config: XPackConfiguration<unknown> = { output: { publicPath: '/' } };

    await mutPathModePublicPath(createEngine('path'), config);

    expect(config.output?.publicPath).toBe('auto');
  });

  it('keeps other output options when overriding publicPath', async () => {
    const config: XPackConfiguration<unknown> = {
      output: { publicPath: '/static/', library: 'my-lib' },
    };

    await mutPathModePublicPath(createEngine('path'), config);

    expect(config.output).toEqual({ publicPath: 'auto', library: 'my-lib' });
  });

  it('leaves full URLs and protocol-relative publicPath untouched', async () => {
    const withFullUrl: XPackConfiguration<unknown> = {
      output: { publicPath: 'https://cdn.example.com/' },
    };
    const withProtocolRelative: XPackConfiguration<unknown> = {
      output: { publicPath: '//cdn.example.com/' },
    };

    await mutPathModePublicPath(createEngine('path'), withFullUrl);
    await mutPathModePublicPath(createEngine('path'), withProtocolRelative);

    expect(withFullUrl.output?.publicPath).toBe('https://cdn.example.com/');
    expect(withProtocolRelative.output?.publicPath).toBe('//cdn.example.com/');
  });

  it('leaves auto and unset publicPath untouched', async () => {
    const withAuto: XPackConfiguration<unknown> = { output: { publicPath: 'auto' } };
    const withoutOutput: XPackConfiguration<unknown> = {};

    await mutPathModePublicPath(createEngine('path'), withAuto);
    await mutPathModePublicPath(createEngine('path'), withoutOutput);

    expect(withAuto.output?.publicPath).toBe('auto');
    expect(withoutOutput.output).toBeUndefined();
  });

  it('does nothing for hostname-addressed apps', async () => {
    const config: XPackConfiguration<unknown> = { output: { publicPath: '/' } };

    await mutPathModePublicPath(createEngine('hostname'), config);

    expect(config.output?.publicPath).toBe('/');
  });
});
