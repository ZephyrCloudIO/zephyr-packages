import {
  createZephyrNitroMetadata,
  createZephyrNitroMetadataAsset,
  createZephyrNitroPreset,
} from './zephyr-nitro-preset';

interface NitroLike {
  options: {
    preset: string;
    rootDir?: string;
    output: {
      dir: string;
      serverDir?: string;
    };
  };
  logger: {
    info: jest.Mock;
    success: jest.Mock;
    warn?: jest.Mock;
    error?: jest.Mock;
  };
}

describe('zephyr nitro preset', () => {
  it('creates a preset extending cloudflare_module by default', () => {
    const preset = createZephyrNitroPreset();

    expect(preset.extends).toBe('cloudflare_module');
    expect(preset.hooks).toBeDefined();
    expect(typeof preset.hooks?.compiled).toBe('function');
  });

  it('creates metadata payload for the current Nitro build', () => {
    const metadata = createZephyrNitroMetadata({
      options: {
        preset: 'cloudflare-module',
        output: { dir: '/tmp/zephyr-output' },
      },
    });

    expect(metadata).toEqual({
      generatedBy: 'zephyr-nitro-preset',
      outputDir: '/tmp/zephyr-output',
      preset: 'cloudflare-module',
    });
  });

  it('supports overriding metadata outputDir', () => {
    const metadata = createZephyrNitroMetadata(
      {
        options: {
          preset: 'cloudflare-module',
          output: { dir: '/tmp/zephyr-output', serverDir: '/tmp/zephyr-output/server' },
        },
      },
      '/tmp/zephyr-output/server'
    );

    expect(metadata.outputDir).toBe('/tmp/zephyr-output/server');
  });

  it('builds a metadata asset for bundler output', () => {
    const asset = createZephyrNitroMetadataAsset(
      {
        options: {
          preset: 'cloudflare-module',
          output: { dir: '/tmp/zephyr-output' },
        },
      },
      '.zephyr/nitro.json'
    );

    expect(asset.type).toBe('asset');
    expect(asset.fileName).toBe('.zephyr/nitro.json');
    expect(asset.source).toContain('"generatedBy": "zephyr-nitro-preset"');
    expect(asset.source).toContain('"preset": "cloudflare-module"');
  });

  it('runs rollup hook and emits metadata through bundler lifecycle', async () => {
    const outputDir = '/tmp/zephyr-nitro-compiled/server';
    const relativePath = '.zephyr/nitro.json';
    const preset = createZephyrNitroPreset({ metadataFile: relativePath });
    const hooks = preset.hooks as {
      'build:before': (nitro: NitroLike) => void;
      'rollup:before': (
        nitro: NitroLike,
        config: { plugins?: Array<{ generateBundle?: () => Promise<void> | void }> }
      ) => void;
    };
    const nitro: NitroLike = {
      options: {
        preset: 'cloudflare-module',
        output: { dir: outputDir },
      },
      logger: {
        info: jest.fn(),
        success: jest.fn(),
      },
    };

    const config: {
      output?: { dir?: string };
      plugins?: Array<{ generateBundle?: () => Promise<void> | void }>;
    } = { output: { dir: outputDir } };
    const emitFile = jest.fn();

    hooks['build:before'](nitro);
    hooks['rollup:before'](nitro, config);

    expect(config.plugins).toHaveLength(1);
    const plugin = config.plugins?.[0];
    await plugin?.generateBundle?.call({ emitFile });

    expect(emitFile).toHaveBeenCalledWith({
      fileName: '.zephyr/nitro.json',
      source: expect.stringContaining('"generatedBy": "zephyr-nitro-preset"'),
      type: 'asset',
    });
    expect(emitFile).toHaveBeenCalledWith({
      fileName: '.zephyr/nitro.json',
      source: expect.stringContaining('"outputDir": "/tmp/zephyr-nitro-compiled/server"'),
      type: 'asset',
    });
    expect(nitro.logger.info).toHaveBeenCalled();
    expect(nitro.logger.success).toHaveBeenCalledWith(
      `[zephyr-nitro-preset] Emitted Nitro metadata asset at ${outputDir}/${relativePath}.`
    );
  });

  it('skips zephyr deploy when deploy option is disabled', async () => {
    const preset = createZephyrNitroPreset({ deploy: false });
    const hooks = preset.hooks as {
      compiled: (nitro: NitroLike) => Promise<void>;
    };
    const nitro: NitroLike = {
      options: {
        preset: 'cloudflare-module',
        output: { dir: '/tmp/zephyr-output' },
      },
      logger: {
        info: jest.fn(),
        success: jest.fn(),
      },
    };

    await hooks.compiled(nitro);
    expect(nitro.logger.info).toHaveBeenCalledWith(
      '[zephyr-nitro-preset] Zephyr deploy disabled for this build.'
    );
    expect(nitro.logger.success).not.toHaveBeenCalled();
  });

  it('rejects absolute metadata paths for bundler assets', () => {
    expect(() =>
      createZephyrNitroMetadataAsset(
        {
          options: {
            preset: 'cloudflare-module',
            output: { dir: '/tmp/zephyr-output' },
          },
        },
        '/tmp/absolute.json'
      )
    ).toThrow('must be relative');
  });
});
