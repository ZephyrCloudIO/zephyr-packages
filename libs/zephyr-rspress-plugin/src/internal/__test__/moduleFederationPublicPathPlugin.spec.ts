import {
  moduleFederationPublicPathPlugin,
  setModuleFederationGetPublicPath,
  setPortableModuleFederationPublicPath,
  ZEPHYR_RSPRESS_MODULE_FEDERATION_GET_PUBLIC_PATH,
} from '../assets/moduleFederationPublicPathPlugin';

describe('moduleFederationPublicPathPlugin', () => {
  it('sets getPublicPath on rspack module federation plugins with exposes', () => {
    const moduleFederationPlugin = {
      name: 'RspackModuleFederationPlugin',
      _options: {
        exposes: {
          './docs': './docs/index.mdx',
        },
      },
    };

    setModuleFederationGetPublicPath([moduleFederationPlugin]);

    expect(moduleFederationPlugin._options.getPublicPath).toBe(
      ZEPHYR_RSPRESS_MODULE_FEDERATION_GET_PUBLIC_PATH
    );
  });

  it('preserves an explicit getPublicPath', () => {
    const moduleFederationPlugin = {
      name: 'RspackModuleFederationPlugin',
      _options: {
        exposes: {
          './docs': './docs/index.mdx',
        },
        getPublicPath: 'return "https://example.com/"',
      },
    };

    setModuleFederationGetPublicPath([moduleFederationPlugin]);

    expect(moduleFederationPlugin._options.getPublicPath).toBe(
      'return "https://example.com/"'
    );
  });

  it('skips consumers and non-module-federation plugins', () => {
    const consumerPlugin = {
      name: 'RspackModuleFederationPlugin',
      _options: {},
    };
    const otherPlugin = {
      name: 'OtherPlugin',
      _options: {
        exposes: {
          './docs': './docs/index.mdx',
        },
      },
    };

    setModuleFederationGetPublicPath([consumerPlugin, otherPlugin]);

    expect(consumerPlugin._options.getPublicPath).toBeUndefined();
    expect(otherPlugin._options.getPublicPath).toBeUndefined();
  });

  it('normalizes absolute compiler publicPath for remote browser builds', () => {
    const moduleFederationPlugin = {
      name: 'RspackModuleFederationPlugin',
      _options: {
        exposes: {
          './docs': './docs/index.mdx',
        },
      },
    };
    const config = {
      output: {
        publicPath: 'http://localhost:4178/',
      },
      plugins: [moduleFederationPlugin],
    };

    setPortableModuleFederationPublicPath(config);

    expect(config.output.publicPath).toBe('/');
    expect(moduleFederationPlugin._options.getPublicPath).toBe(
      ZEPHYR_RSPRESS_MODULE_FEDERATION_GET_PUBLIC_PATH
    );
  });

  it('preserves relative compiler publicPath values', () => {
    const moduleFederationPlugin = {
      name: 'RspackModuleFederationPlugin',
      _options: {
        exposes: {
          './docs': './docs/index.mdx',
        },
      },
    };
    const config = {
      output: {
        publicPath: '/docs/',
      },
      plugins: [moduleFederationPlugin],
    };

    setPortableModuleFederationPublicPath(config);

    expect(config.output.publicPath).toBe('/docs/');
  });

  it('runs after module federation materializes rspack plugins', () => {
    const moduleFederationPlugin = {
      name: 'RspackModuleFederationPlugin',
      _options: {
        exposes: {
          './docs': './docs/index.mdx',
        },
      },
    };
    const onBeforeCreateCompiler = jest.fn();
    const plugin = moduleFederationPublicPathPlugin();

    plugin.setup({ onBeforeCreateCompiler });

    expect(onBeforeCreateCompiler).toHaveBeenCalledWith({
      order: 'post',
      handler: expect.any(Function),
    });

    const [{ handler }] = onBeforeCreateCompiler.mock.calls[0];
    handler({
      bundlerConfigs: [
        {
          output: {
            publicPath: 'http://localhost:4178/',
          },
          plugins: [moduleFederationPlugin],
        },
      ],
    });

    expect(moduleFederationPlugin._options.getPublicPath).toBe(
      ZEPHYR_RSPRESS_MODULE_FEDERATION_GET_PUBLIC_PATH
    );
  });
});
