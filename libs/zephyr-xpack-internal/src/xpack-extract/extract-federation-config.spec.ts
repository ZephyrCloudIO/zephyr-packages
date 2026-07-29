import { describe, expect, it } from '@rstest/core';
import { extractFederatedConfig } from './extract-federation-config';

describe('extractFederatedConfig', () => {
  it('retains configs exposed through the standard options wrapper', () => {
    const config = extractFederatedConfig({
      apply() {},
      options: {
        config: {
          name: 'worker',
          filename: 'targets/worker/remoteEntry.mjs',
        },
      },
    });

    expect(config).toEqual({
      name: 'worker',
      filename: 'targets/worker/remoteEntry.mjs',
    });
  });

  it('uses the legacy default filename consistently for every wrapper shape', () => {
    const options = { name: 'desktop' };
    const config = extractFederatedConfig({
      apply() {},
      options,
    });

    expect(config).toEqual({ name: 'desktop', filename: 'remoteEntry.js' });
    expect(options).toEqual({ name: 'desktop' });
  });

  it('applies Nx config overrides to published federation metadata', () => {
    const runtimePlugins: [string, Record<string, unknown>][] = [
      [
        '/plugins/zephyr-runtime.js',
        { manifestUrl: 'https://cdn.example.test/app/zephyr-manifest.json' },
      ],
    ];
    const config = extractFederatedConfig({
      apply() {},
      _options: {
        config: {
          name: 'host',
          filename: 'remoteEntry.mjs',
          runtimePlugins: ['/plugins/base-runtime-ignored-by-nx.js'],
        },
      },
      configOverride: { runtimePlugins },
    });

    expect(config).toEqual({
      name: 'host',
      filename: 'remoteEntry.mjs',
      runtimePlugins,
    });
  });
});
