import { describe, expect, it } from '@rstest/core';
import type { ZephyrEngine } from 'zephyr-agent';
import type { XPackConfiguration } from '../xpack.types';
import { mutPathModePublicPath } from './mut-path-mode-public-path';

function engine(
  addressMode: 'hostname' | 'path' | undefined,
  environmentAddressMode?: 'hostname' | 'path'
): ZephyrEngine {
  return {
    application_configuration: Promise.resolve({
      ADDRESS_MODE: addressMode,
      ENVIRONMENTS: environmentAddressMode
        ? { preview: { addressMode: environmentAddressMode } }
        : undefined,
    }),
  } as unknown as ZephyrEngine;
}

describe('mutPathModePublicPath', () => {
  it.each(['/', '/static/'])(
    'overrides origin-absolute publicPath %s and preserves output options',
    async (publicPath) => {
      const config: XPackConfiguration<unknown> = {
        output: { publicPath, library: 'app' },
      };

      await mutPathModePublicPath(engine('path'), config);

      expect(config.output).toEqual({ publicPath: 'auto', library: 'app' });
    }
  );

  it('normalizes for a path-addressed secondary environment', async () => {
    const config: XPackConfiguration<unknown> = { output: { publicPath: '/' } };

    await mutPathModePublicPath(engine('hostname', 'path'), config);

    expect(config.output?.publicPath).toBe('auto');
  });

  it.each([
    undefined,
    '',
    './',
    'auto',
    'https://cdn.example.test/',
    '//cdn.example.test/',
  ])('preserves prefix-safe or explicitly hosted publicPath %s', async (publicPath) => {
    const config: XPackConfiguration<unknown> =
      publicPath === undefined ? {} : { output: { publicPath } };
    const originalOutput = config.output;

    await mutPathModePublicPath(engine('path'), config);

    expect(config.output).toBe(originalOutput);
  });

  it('does nothing for hostname-only targets', async () => {
    const config: XPackConfiguration<unknown> = { output: { publicPath: '/' } };

    await mutPathModePublicPath(engine('hostname'), config);

    expect(config.output?.publicPath).toBe('/');
  });
});
