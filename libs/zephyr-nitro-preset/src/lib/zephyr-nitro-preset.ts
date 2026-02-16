import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';

export interface NitroLike {
  options: {
    preset: string;
    output: {
      dir: string;
    };
  };
  logger: {
    info: (message: string) => void;
    success: (message: string) => void;
  };
}

export interface ZephyrNitroPreset {
  extends?: string;
  hooks?: {
    'build:before'?: (nitro: NitroLike) => void | Promise<void>;
    compiled?: (nitro: NitroLike) => void | Promise<void>;
  };
}

export interface ZephyrNitroPresetOptions {
  metadataFile?: string;
  loggerTag?: string;
}

export interface ZephyrNitroBuildMetadata {
  generatedBy: 'zephyr-nitro-preset';
  preset: string;
  outputDir: string;
}

const DEFAULT_BASE_PRESET = 'cloudflare_module';
const DEFAULT_METADATA_FILE = '.zephyr/nitro-build.json';
const DEFAULT_LOGGER_TAG = 'zephyr-nitro-preset';

function resolveMetadataPath(outputDir: string, metadataFile: string): string {
  return isAbsolute(metadataFile) ? metadataFile : join(outputDir, metadataFile);
}

export async function writeZephyrNitroMetadata(
  nitro: Pick<NitroLike, 'options'>,
  metadataFile: string
): Promise<string> {
  const outputDir = nitro.options.output.dir;
  const metadataPath = resolveMetadataPath(outputDir, metadataFile);

  const metadata: ZephyrNitroBuildMetadata = {
    generatedBy: 'zephyr-nitro-preset',
    preset: nitro.options.preset,
    outputDir,
  };

  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  return metadataPath;
}

export function createZephyrNitroPreset(
  options: ZephyrNitroPresetOptions = {}
): ZephyrNitroPreset {
  const metadataFile = options.metadataFile ?? DEFAULT_METADATA_FILE;
  const loggerTag = options.loggerTag ?? DEFAULT_LOGGER_TAG;

  return {
    extends: DEFAULT_BASE_PRESET,
    hooks: {
      'build:before'(nitro) {
        nitro.logger.info(`[${loggerTag}] Using preset \`${DEFAULT_BASE_PRESET}\`.`);
      },
      async compiled(nitro) {
        const metadataPath = await writeZephyrNitroMetadata(nitro, metadataFile);
        nitro.logger.success(
          `[${loggerTag}] Wrote Nitro metadata file to ${metadataPath}.`
        );
      },
    },
  };
}

const zephyrNitroPreset = createZephyrNitroPreset();

export default zephyrNitroPreset;
