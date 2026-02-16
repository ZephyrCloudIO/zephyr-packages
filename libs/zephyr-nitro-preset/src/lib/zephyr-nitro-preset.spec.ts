import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createZephyrNitroPreset, writeZephyrNitroMetadata } from './zephyr-nitro-preset';

interface NitroLike {
  options: {
    preset: string;
    output: {
      dir: string;
    };
  };
  logger: {
    info: jest.Mock;
    success: jest.Mock;
  };
}

describe('zephyr nitro preset', () => {
  it('creates a preset extending cloudflare_module by default', () => {
    const preset = createZephyrNitroPreset();

    expect(preset.extends).toBe('cloudflare_module');
    expect(preset.hooks).toBeDefined();
  });

  it('writes metadata file for the current Nitro build', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'zephyr-nitro-preset-'));
    const metadataPath = join(outputDir, '.zephyr', 'build.json');

    try {
      const nitro = {
        options: {
          preset: 'cloudflare-module',
          output: { dir: outputDir },
        },
      } as NitroLike;

      await writeZephyrNitroMetadata(nitro, '.zephyr/build.json');
      const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));

      expect(metadata).toEqual({
        generatedBy: 'zephyr-nitro-preset',
        outputDir,
        preset: 'cloudflare-module',
      });
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('runs compiled hook and writes metadata', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'zephyr-nitro-compiled-'));
    const relativePath = '.zephyr/nitro.json';
    const metadataPath = join(outputDir, '.zephyr', 'nitro.json');
    const preset = createZephyrNitroPreset({ metadataFile: relativePath });
    const hooks = preset.hooks as {
      compiled: (nitro: NitroLike) => Promise<void>;
      'build:before': (nitro: NitroLike) => void;
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

    try {
      hooks['build:before'](nitro);
      await hooks.compiled(nitro);

      const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
      expect(metadata.generatedBy).toBe('zephyr-nitro-preset');
      expect(nitro.logger.info).toHaveBeenCalled();
      expect(nitro.logger.success).toHaveBeenCalled();
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
