import { extname, isAbsolute, join, normalize, posix } from 'node:path';

export interface NitroLike {
  options: {
    preset: string;
    rootDir?: string;
    output: {
      dir: string;
      serverDir?: string;
    };
  };
  logger: {
    info: (message: string) => void;
    success: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
}

export interface ZephyrNitroPreset {
  extends?: string;
  hooks?: {
    'build:before'?: (nitro: NitroLike) => void | Promise<void>;
    'rollup:before'?: (
      nitro: NitroLike,
      config: NitroBundlerConfigLike
    ) => void | Promise<void>;
    compiled?: (nitro: NitroLike) => void | Promise<void>;
  };
}

export type ZephyrNitroDeployTarget = 'web' | 'ios' | 'android';

export interface ZephyrNitroDeployOptions {
  enabled?: boolean;
  directory?: string;
  entrypoint?: string;
  target?: ZephyrNitroDeployTarget;
  ssr?: boolean;
  failOnError?: boolean;
}

export interface ZephyrNitroPresetOptions {
  metadataFile?: string;
  loggerTag?: string;
  deploy?: boolean | ZephyrNitroDeployOptions;
}

export interface ZephyrNitroBuildMetadata {
  generatedBy: 'zephyr-nitro-preset';
  preset: string;
  outputDir: string;
}

interface NitroBundlerConfigLike {
  plugins?: unknown[];
  output?: NitroBundlerOutputLike | NitroBundlerOutputLike[];
}

interface NitroBundlerOutputLike {
  dir?: string;
}

interface AssetReference {
  type: 'asset';
  fileName: string;
  source: string;
}

interface AssetEmitterContext {
  emitFile: (asset: AssetReference) => void;
}

interface NitroBundlerPlugin {
  name: string;
  generateBundle?: (this: AssetEmitterContext) => void | Promise<void>;
}

interface DirectoryAsset {
  content: Buffer;
  type: string;
}

interface ResolvedDeployOptions {
  enabled: boolean;
  directory?: string;
  entrypoint?: string;
  target: ZephyrNitroDeployTarget;
  ssr: boolean;
  failOnError: boolean;
}

const DEFAULT_BASE_PRESET = 'cloudflare_module';
const DEFAULT_METADATA_FILE = '.zephyr/nitro-build.json';
const DEFAULT_LOGGER_TAG = 'zephyr-nitro-preset';
const DEFAULT_DEPLOY_TARGET: ZephyrNitroDeployTarget = 'web';
const DEFAULT_DEPLOY_SSR = true;
const DEFAULT_DEPLOY_FAIL_ON_ERROR = true;
const SKIP_DEPLOY_PATTERNS = [/\.map$/i, /node_modules\//i, /\.git\//i, /\.DS_Store$/i];

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.mjs': 'application/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'text/xml',
};

function normalizeMetadataFile(metadataFile: string): string {
  if (isAbsolute(metadataFile)) {
    throw new TypeError(
      '[zephyr-nitro-preset] `metadataFile` must be relative when using the bundler lifecycle.'
    );
  }

  const normalized = normalize(metadataFile).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized === '.') {
    throw new TypeError(
      '[zephyr-nitro-preset] `metadataFile` must point to a file path.'
    );
  }

  return normalized;
}

function normalizeDeployOptions(
  deployOption: boolean | ZephyrNitroDeployOptions | undefined
): ResolvedDeployOptions {
  if (typeof deployOption === 'boolean') {
    return {
      enabled: deployOption,
      target: DEFAULT_DEPLOY_TARGET,
      ssr: DEFAULT_DEPLOY_SSR,
      failOnError: DEFAULT_DEPLOY_FAIL_ON_ERROR,
    };
  }

  return {
    enabled: deployOption?.enabled ?? true,
    directory: deployOption?.directory,
    entrypoint: deployOption?.entrypoint,
    target: deployOption?.target ?? DEFAULT_DEPLOY_TARGET,
    ssr: deployOption?.ssr ?? DEFAULT_DEPLOY_SSR,
    failOnError: deployOption?.failOnError ?? DEFAULT_DEPLOY_FAIL_ON_ERROR,
  };
}

function logWarning(nitro: NitroLike, message: string): void {
  if (nitro.logger.warn) {
    nitro.logger.warn(message);
    return;
  }

  nitro.logger.info(message);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new TypeError(`[zephyr-nitro-preset] ${String(error)}`);
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function shouldSkipDeployAsset(filePath: string): boolean {
  return SKIP_DEPLOY_PATTERNS.some((pattern) => pattern.test(filePath));
}

function detectContentType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function normalizeEntrypoint(entrypoint: string): string {
  let normalized = entrypoint.trim().replace(/\\/g, '/');
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

function resolveDeployEntrypoint(
  deployOptions: ResolvedDeployOptions,
  assets: Record<string, DirectoryAsset>
): string | undefined {
  if (deployOptions.entrypoint) {
    return normalizeEntrypoint(deployOptions.entrypoint);
  }

  const candidates = ['index.mjs', 'index.js', 'server/index.mjs', 'server/index.js'];
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(assets, candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function toImportSpecifier(fromFile: string, toFile: string): string {
  const relativePath = posix.relative(posix.dirname(fromFile), toFile);
  if (!relativePath) {
    return './';
  }

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function createCloudflareEntrypointWrapper(entrypoint: string): {
  wrapperPath: string;
  source: string;
} {
  const wrapperPath = '.zephyr/entrypoint.mjs';
  const importPath = toImportSpecifier(wrapperPath, entrypoint);
  const source = `import nitroHandler from '${importPath}';

const base = nitroHandler?.default ?? nitroHandler;

export default {
  ...base,
  async fetch(request, env = {}, context) {
    if (typeof base?.fetch === 'function') {
      return base.fetch(request, env ?? {}, context);
    }

    if (typeof base === 'function') {
      return base(request, env ?? {}, context);
    }

    throw new TypeError('[zephyr-nitro-preset] Invalid Nitro Cloudflare entrypoint export.');
  },
};
`;

  return { wrapperPath, source };
}

export function createZephyrNitroMetadata(
  nitro: Pick<NitroLike, 'options'>,
  outputDir = nitro.options.output.dir
): ZephyrNitroBuildMetadata {
  return {
    generatedBy: 'zephyr-nitro-preset',
    preset: nitro.options.preset,
    outputDir,
  };
}

export function createZephyrNitroMetadataAsset(
  nitro: Pick<NitroLike, 'options'>,
  metadataFile: string,
  outputDir = nitro.options.output.dir
): AssetReference {
  const fileName = normalizeMetadataFile(metadataFile);
  return {
    type: 'asset',
    fileName,
    source: `${JSON.stringify(createZephyrNitroMetadata(nitro, outputDir), null, 2)}\n`,
  };
}

function resolveBundlerOutputDir(
  nitro: NitroLike,
  config: NitroBundlerConfigLike
): string {
  const output = Array.isArray(config.output) ? config.output[0] : config.output;
  return output?.dir ?? nitro.options.output.serverDir ?? nitro.options.output.dir;
}

function resolveDeployOutputDir(
  nitro: NitroLike,
  deployOptions: ResolvedDeployOptions
): string {
  if (!deployOptions.directory) {
    return nitro.options.output.dir;
  }

  if (isAbsolute(deployOptions.directory)) {
    return deployOptions.directory;
  }

  return join(nitro.options.output.dir, deployOptions.directory);
}

function createZephyrMetadataPlugin(
  nitro: NitroLike,
  outputDir: string,
  metadataFile: string,
  loggerTag: string
): NitroBundlerPlugin {
  const emittedMetadataPath = join(outputDir, normalizeMetadataFile(metadataFile));

  return {
    name: 'zephyr-nitro-metadata',
    generateBundle() {
      const asset = createZephyrNitroMetadataAsset(nitro, metadataFile, outputDir);
      this.emitFile(asset);
      nitro.logger.success(
        `[${loggerTag}] Emitted Nitro metadata asset at ${emittedMetadataPath}.`
      );
    },
  };
}

async function uploadNitroOutputToZephyr(
  nitro: NitroLike,
  outputDir: string,
  deployOptions: ResolvedDeployOptions
): Promise<{ deploymentUrl: string | null; entrypoint?: string }> {
  const zephyrAgent = await import('zephyr-agent');
  const files = await zephyrAgent.readDirRecursiveWithContents(outputDir);

  const assets = files.reduce<Record<string, DirectoryAsset>>((memo, file) => {
    const relativePath = toPosixPath(file.relativePath);
    if (shouldSkipDeployAsset(relativePath)) {
      return memo;
    }

    memo[relativePath] = {
      content: file.content,
      type: detectContentType(relativePath),
    };
    return memo;
  }, {});

  if (Object.keys(assets).length === 0) {
    throw new TypeError(
      `[zephyr-nitro-preset] No deployable assets found in ${outputDir}.`
    );
  }

  let entrypoint = resolveDeployEntrypoint(deployOptions, assets);

  if (deployOptions.ssr && entrypoint) {
    const { wrapperPath, source } = createCloudflareEntrypointWrapper(entrypoint);
    assets[wrapperPath] = {
      content: Buffer.from(source, 'utf8'),
      type: 'application/javascript',
    };
    entrypoint = wrapperPath;
  }

  const assetsMap = zephyrAgent.buildAssetsMap(
    assets,
    (asset: DirectoryAsset) => asset.content,
    (asset: DirectoryAsset) => asset.type
  );

  const zephyrEngine = await zephyrAgent.ZephyrEngine.create({
    builder: 'unknown',
    context: nitro.options.rootDir ?? process.cwd(),
  });

  zephyrEngine.env.target = deployOptions.target;
  zephyrEngine.env.ssr = deployOptions.ssr;

  const buildStats = await zephyrAgent.zeBuildDashData(zephyrEngine);
  let deploymentUrl: string | null = null;

  await zephyrEngine.upload_assets({
    assetsMap,
    buildStats,
    snapshotType: deployOptions.ssr ? 'ssr' : 'csr',
    entrypoint,
    hooks: {
      onDeployComplete(deploymentInfo) {
        deploymentUrl = deploymentInfo.url;
      },
    },
  });

  return { deploymentUrl, entrypoint };
}

export function createZephyrNitroPreset(
  options: ZephyrNitroPresetOptions = {}
): ZephyrNitroPreset {
  const metadataFile = options.metadataFile ?? DEFAULT_METADATA_FILE;
  const loggerTag = options.loggerTag ?? DEFAULT_LOGGER_TAG;
  const deployOptions = normalizeDeployOptions(options.deploy);

  return {
    extends: DEFAULT_BASE_PRESET,
    hooks: {
      'build:before'(nitro) {
        nitro.logger.info(`[${loggerTag}] Using preset \`${DEFAULT_BASE_PRESET}\`.`);
      },
      'rollup:before'(nitro, config) {
        const outputDir = resolveBundlerOutputDir(nitro, config);
        const plugin = createZephyrMetadataPlugin(
          nitro,
          outputDir,
          metadataFile,
          loggerTag
        );

        if (!Array.isArray(config.plugins)) {
          config.plugins = [plugin];
          return;
        }

        config.plugins.push(plugin);
      },
      async compiled(nitro) {
        if (!deployOptions.enabled) {
          nitro.logger.info(`[${loggerTag}] Zephyr deploy disabled for this build.`);
          return;
        }

        const deployOutputDir = resolveDeployOutputDir(nitro, deployOptions);

        nitro.logger.info(
          `[${loggerTag}] Uploading Nitro output to Zephyr from ${deployOutputDir}.`
        );

        try {
          const { deploymentUrl, entrypoint } = await uploadNitroOutputToZephyr(
            nitro,
            deployOutputDir,
            deployOptions
          );

          if (entrypoint) {
            nitro.logger.info(`[${loggerTag}] Zephyr SSR entrypoint: ${entrypoint}.`);
          }

          if (deploymentUrl) {
            nitro.logger.success(
              `[${loggerTag}] Zephyr deployment URL: ${deploymentUrl}`
            );
            return;
          }

          nitro.logger.success(
            `[${loggerTag}] Zephyr deploy completed but no deployment URL was returned.`
          );
        } catch (error) {
          const message = `[${loggerTag}] Zephyr deploy failed: ${toErrorMessage(error)}`;
          if (deployOptions.failOnError) {
            throw toError(error);
          }

          logWarning(nitro, message);
        }
      },
    },
  };
}

const zephyrNitroPreset = createZephyrNitroPreset();

export default zephyrNitroPreset;
