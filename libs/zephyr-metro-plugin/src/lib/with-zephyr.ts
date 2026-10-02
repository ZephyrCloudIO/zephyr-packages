import { createHash } from 'crypto';
import fs from 'fs';
import type { ConfigT } from 'metro-config';
import { createRequire } from 'module';
import path from 'path';
import {
  collectZEPublicVars,
  createManifestContent,
  handleGlobalError,
  ze_log,
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
} from 'zephyr-agent';
import type { ZephyrEnvTransformerOptions } from './env-transformer';
import {
  assertMetroNativeBuildTarget,
  type MetroNativeBuildTarget,
} from './native-target';

export interface ZephyrMetroOptions {
  /** Application name */
  name?: string;
  /** Remote dependencies configuration */
  remotes?: Record<string, string>;
  /** Target platform */
  target?: MetroNativeBuildTarget;
  /** Custom manifest endpoint path (default: /zephyr-manifest.json) */
  manifestPath?: string;
  /** Throw an error if manifest generation fails (default: false - logs warning only) */
  failOnManifestError?: boolean;
}

export interface ZephyrModuleFederationConfig {
  name: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Record<string, any>;
}

/** Configure Metro for Zephyr. Publication commands must be registered separately. */
export function withZephyr(zephyrOptions: ZephyrMetroOptions = {}) {
  assertConfiguredMetroTarget(zephyrOptions.target);

  return async (metroConfig: ConfigT): Promise<ConfigT> => {
    // Re-check at invocation time in case an untyped caller mutates the options
    // object after creating the wrapper.
    assertConfiguredMetroTarget(zephyrOptions.target);

    try {
      return await applyZephyrToMetroConfig(metroConfig, zephyrOptions);
    } catch (error) {
      handleGlobalError(error);
      return metroConfig; // Return original config on error
    }
  };
}

function assertConfiguredMetroTarget(target: unknown): void {
  if (target !== undefined) {
    assertMetroNativeBuildTarget(target, 'withZephyr({ target })');
  }
}

async function applyZephyrToMetroConfig(
  metroConfig: ConfigT,
  zephyrOptions: ZephyrMetroOptions
): Promise<ConfigT> {
  const projectRoot = metroConfig.projectRoot || process.cwd();
  const manifestPath = zephyrOptions.manifestPath || '/zephyr-manifest.json';

  // Initialize Zephyr Engine
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'metro',
    context: projectRoot,
  });

  try {
    if (zephyrOptions.target) {
      zephyr_engine.env.target = zephyrOptions.target;
    }

    // Extract remote dependencies from zephyr options
    const dependencyPairs = extractMetroRemoteDependencies(zephyrOptions.remotes || {});

    // Resolve dependencies through Zephyr
    const resolved_dependencies =
      await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

    const babelTransformerPath = installEnvTransformer(
      projectRoot,
      metroConfig.transformer?.babelTransformerPath,
      zephyr_engine.application_uid
    );

    const enhancedConfig: ConfigT = {
      ...metroConfig,
      transformer: {
        ...metroConfig.transformer,
        babelTransformerPath,
      },
      resolver: {
        ...metroConfig.resolver,
        // Add Zephyr-specific resolution logic
        resolverMainFields: [
          ...(metroConfig.resolver?.resolverMainFields || [
            'react-native',
            'browser',
            'main',
          ]),
          'zephyr',
        ],
      },
      server: {
        ...metroConfig.server,
        // Enhance server with manifest endpoint
        enhanceMiddleware: (middleware: any, server: any) => {
          // Get the base middleware (either enhanced or original)
          const baseMiddleware = metroConfig.server?.enhanceMiddleware
            ? metroConfig.server.enhanceMiddleware(middleware, server)
            : middleware;

          // Return a new middleware that intercepts manifest requests
          return (req: any, res: any, next: any) => {
            // Check if this is a manifest request
            const url = req.url?.split('?')[0]; // Remove query string
            if (url === manifestPath) {
              try {
                const manifestContent = createManifestContent(
                  resolved_dependencies || []
                );
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-cache');
                res.end(manifestContent);
                return;
              } catch (error) {
                handleGlobalError(error);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Failed to generate manifest' }));
                return;
              }
            }

            // Pass through to base middleware
            return baseMiddleware(req, res, next);
          };
        },
      },
    };

    // Generate manifest file for production builds
    const manifestGenerated = await generateManifestFile(
      projectRoot,
      manifestPath,
      resolved_dependencies || []
    );

    if (!manifestGenerated) {
      const errorMessage =
        'Manifest file generation failed - runtime updates may not work correctly';
      if (zephyrOptions.failOnManifestError) {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, { message: errorMessage });
      }
      ze_log.error(errorMessage);
    }

    // Lets the publication command wrapper detect that ZE_PUBLIC_* reads are rewritten.
    global.__ZEPHYR_METRO_ENV_REWRITE__ = zephyr_engine.application_uid;
    ze_log.app('Zephyr Metro configured; no artifacts were uploaded');

    return enhancedConfig;
  } finally {
    // This configuration-only integration resolves remotes and writes a local manifest;
    // it never uploads. Release the generation allocated by create() on every path.
    if (zephyr_engine.hasActiveBuild) {
      zephyr_engine.build_failed();
    }
  }
}

/**
 * Writes a Babel transformer module that rewrites `ZE_PUBLIC_*` reads before delegating
 * to the configured transformer, and returns its path.
 *
 * The file lives outside Module Federation's tmp dir (deleted on every config load) and
 * its name embeds the cache key, so env or UID changes produce a new transformer and
 * Metro never serves stale transforms.
 *
 * @internal Exported for tests.
 */
export function installEnvTransformer(
  projectRoot: string,
  configuredTransformerPath: string | undefined,
  applicationUid: string
): string {
  const projectRequire = createRequire(path.resolve(projectRoot, 'package.json'));
  const originalTransformerPath = projectRequire.resolve(
    configuredTransformerPath ?? 'metro-babel-transformer'
  );
  const buildEnv = collectZEPublicVars(process.env);
  const { version } = createRequire(__filename)('zephyr-metro-plugin/package.json');
  // Metro hashes the configured transformer file's contents; wrapping hides the
  // original's, so fold them in (Module Federation regenerates its transformer).
  const cacheKey = createHash('sha256')
    .update(JSON.stringify([version, applicationUid, originalTransformerPath, buildEnv]))
    .update(fs.readFileSync(originalTransformerPath))
    .digest('hex')
    .slice(0, 16);

  const options: ZephyrEnvTransformerOptions = {
    originalTransformerPath,
    applicationUid,
    buildEnv,
    cacheKey,
  };
  const adapterPath = path.join(__dirname, 'env-transformer.js');
  const source = `module.exports = require(${JSON.stringify(adapterPath)}).createZephyrEnvTransformer(${JSON.stringify(options)});\n`;

  const outDir = path.join(projectRoot, 'node_modules', '.zephyr-metro');
  const outPath = path.join(outDir, `env-transformer-${cacheKey}.js`);
  const tmpPath = `${outPath}.${process.pid}.tmp`;
  fs.mkdirSync(outDir, { recursive: true });
  // Rename atomically so parallel Metro workers never read a partial file.
  fs.writeFileSync(tmpPath, source, 'utf-8');
  fs.renameSync(tmpPath, outPath);
  return outPath;
}

/** Extract remote dependencies from Metro configuration */
function extractMetroRemoteDependencies(remotes: Record<string, string>) {
  return Object.entries(remotes).map(([name, url]) => {
    // Parse remote URL - could be just URL or name@url format
    const [remoteName, remoteUrl] = url.includes('@') ? url.split('@') : [name, url];

    return {
      name: remoteName,
      version: 'latest', // Metro doesn't have version concept like webpack MF
      remote_url: remoteUrl,
    };
  });
}

/** Generate zephyr-manifest.json file - returns true on success, false on failure */
async function generateManifestFile(
  projectRoot: string,
  manifestEndpoint: string,
  resolved_dependencies: any[]
): Promise<boolean> {
  try {
    const manifestContent = createManifestContent(resolved_dependencies);
    // Convert endpoint path to filename (e.g., /zephyr-manifest.json -> zephyr-manifest.json)
    const manifestFilename = manifestEndpoint.replace(/^\//, '');
    const manifestFilePath = path.join(projectRoot, 'assets', manifestFilename);

    // Ensure assets directory exists
    const assetsDir = path.dirname(manifestFilePath);
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    await fs.promises.writeFile(manifestFilePath, manifestContent, 'utf-8');
    ze_log.manifest(`Generated manifest at: ${manifestFilePath}`);
    return true;
  } catch (error) {
    ze_log.error(`Failed to generate manifest file: ${ZephyrError.format(error)}`);
    return false;
  }
}

/** Legacy function name for backward compatibility */
export const withZephyrMetro = withZephyr;
