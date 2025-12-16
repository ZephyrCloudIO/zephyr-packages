import fs from 'fs';
import type { ConfigT } from 'metro-config';
import path from 'path';
import {
  handleGlobalError,
  createManifestContent,
  ze_log,
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
} from 'zephyr-agent';

export interface ZephyrMetroOptions {
  /** Application name */
  name?: string;
  /** Remote dependencies configuration */
  remotes?: Record<string, string>;
  /** Target platform */
  target?: 'ios' | 'android';
  /** Custom manifest endpoint path (default: /zephyr-manifest.json) */
  manifestPath?: string;
  /** Custom entry file patterns for runtime injection (more conservative targeting) */
  entryFiles?: string[];
  /** Throw an error if manifest generation fails (default: false - logs warning only) */
  failOnManifestError?: boolean;
}

export interface ZephyrModuleFederationConfig {
  name: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Record<string, any>;
}

/** Metro plugin configuration function for Zephyr */
export function withZephyr(zephyrOptions: ZephyrMetroOptions = {}) {
  return async (metroConfig: ConfigT): Promise<ConfigT> => {
    try {
      return await applyZephyrToMetroConfig(metroConfig, zephyrOptions);
    } catch (error) {
      handleGlobalError(error);
      return metroConfig;
    }
  };
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

  if (zephyrOptions.target) {
    zephyr_engine.env.target = zephyrOptions.target;
  }

  // Extract remote dependencies from zephyr options
  const dependencyPairs = extractMetroRemoteDependencies(zephyrOptions.remotes || {});

  // Resolve dependencies through Zephyr
  const resolved_dependencies =
    await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

  // Enhanced metro config with Zephyr transformer options
  const zephyrTransformerOptions = {
    manifestPath,
    entryFiles: zephyrOptions.entryFiles,
  };

  const enhancedConfig: ConfigT = {
    ...metroConfig,
    transformer: {
      ...metroConfig.transformer,
      babelTransformerPath: require.resolve('./zephyr-transformer'),
      // Pass zephyr options to transformer via extra data
      ...(metroConfig.transformer as any),
      zephyrTransformerOptions,
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
            void (async () => {
              let manifestContent = JSON.stringify({
                error: 'Failed to generate manifest',
              });
              try {
                manifestContent = createManifestContent(resolved_dependencies || []);
              } catch (error) {
                handleGlobalError(error);
              }

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-cache');
              if (manifestContent.includes('error')) {
                res.statusCode = 500;
              }
              res.end(manifestContent);
            })();
            return;
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

  ze_log.app('Zephyr Metro plugin configured successfully');

  return enhancedConfig;
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
