import { describe, expect, it, rs } from '@rstest/core';
import {
  moduleFederationPublicPathPlugin,
  setPortableModuleFederationPublicPath,
} from '../assets/moduleFederationPublicPathPlugin';

function remotePlugin(options: Record<string, unknown> = {}): {
  name: string;
  _options: Record<string, unknown>;
} {
  return {
    name: 'RspackModuleFederationPlugin',
    _options: { exposes: { './docs': './docs/index.mdx' }, ...options },
  };
}

describe('moduleFederationPublicPathPlugin', () => {
  it('uses native auto public path for an exposed browser remote', () => {
    const plugin = remotePlugin();
    const config = {
      name: 'web',
      output: { publicPath: 'http://localhost:4178/', uniqueName: 'docs' },
      plugins: [plugin],
    };

    setPortableModuleFederationPublicPath(config);

    expect(config.output).toEqual({ publicPath: 'auto', uniqueName: 'docs' });
    expect(plugin._options.getPublicPath).toBeUndefined();
  });

  it('does not bypass Rspress node compiler absolute-public-path requirements', () => {
    const config = {
      name: 'node',
      output: { publicPath: 'http://localhost:4178/' },
      plugins: [remotePlugin()],
    };

    setPortableModuleFederationPublicPath(config);

    expect(config.output.publicPath).toBe('http://localhost:4178/');
  });

  it('preserves consumer, non-MF, and already portable browser configs', () => {
    const configs = [
      {
        output: { publicPath: 'https://cdn.example.test/' },
        plugins: [{ name: 'RspackModuleFederationPlugin', _options: { remotes: {} } }],
      },
      {
        output: { publicPath: 'https://cdn.example.test/' },
        plugins: [{ name: 'OtherPlugin', _options: { exposes: { '.': './src' } } }],
      },
      {
        output: { publicPath: 'auto' },
        plugins: [remotePlugin()],
      },
    ];

    for (const config of configs) {
      const original = config.output.publicPath;
      setPortableModuleFederationPublicPath(config);
      expect(config.output.publicPath).toBe(original);
    }
  });

  it('recognizes nested Nx-style federation options without changing explicit options', () => {
    const options = {
      exposes: { './docs': './docs/index.mdx' },
      getPublicPath: 'return "https://cdn.example.test/"',
    };
    const config = {
      name: 'web',
      output: { publicPath: 'https://build.example.test/' },
      plugins: [{ name: 'NxModuleFederationPlugin', _options: { config: options } }],
    };

    setPortableModuleFederationPublicPath(config);

    expect(config.output.publicPath).toBe('auto');
    expect(options.getPublicPath).toBe('return "https://cdn.example.test/"');
  });

  it('runs after Module Federation materializes compiler plugins', () => {
    const onBeforeCreateCompiler = rs.fn();
    const plugin = moduleFederationPublicPathPlugin();
    plugin.setup({ onBeforeCreateCompiler });

    expect(onBeforeCreateCompiler).toHaveBeenCalledWith({
      order: 'post',
      handler: expect.any(Function),
    });
    const [{ handler }] = onBeforeCreateCompiler.mock.calls[0] as [
      { handler: (args: { bundlerConfigs: unknown[] }) => void },
    ];
    const bundlerConfigs = [
      {
        name: 'web',
        output: { publicPath: 'http://localhost:4178/' },
        plugins: [remotePlugin()],
      },
      {
        name: 'node',
        output: { publicPath: 'http://localhost:4178/' },
        plugins: [remotePlugin()],
      },
    ];

    handler({ bundlerConfigs });

    expect(bundlerConfigs[0]?.output.publicPath).toBe('auto');
    expect(bundlerConfigs[1]?.output.publicPath).toBe('http://localhost:4178/');
  });
});
