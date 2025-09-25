import type { ConfigT } from 'metro-config';
import { logFn, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import { createManifestContent } from 'zephyr-agent/src/lib/transformers/ze-create-manifest';
import path from 'path';
import fs from 'fs';

export interface ZephyrMetroOptions {
  /** Application name */
  name?: string;
  /** Remote dependencies configuration */
  remotes?: Record<string, string>;
  /** Enable OTA updates */
  enableOTA?: boolean;
  /** OTA configuration */
  otaConfig?: {
    checkInterval?: number;
    debug?: boolean;
  };
  /** Target platform */
  target?: 'ios' | 'android';
}

export interface ZephyrModuleFederationConfig {
  name: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Record<string, any>;
}

/** Metro plugin configuration function for Zephyr */
export function withZephyr(zephyrOptions: ZephyrMetroOptions = {}) {
  return (metroConfig: ConfigT): ConfigT => {
    try {
      return applyZephyrToMetroConfig(metroConfig, zephyrOptions);
    } catch (error) {
      logFn('error', ZephyrError.format(error));
      return metroConfig; // Return original config on error
    }
  };
}

async function applyZephyrToMetroConfig(
  metroConfig: ConfigT,
  zephyrOptions: ZephyrMetroOptions
): Promise<ConfigT> {
  const projectRoot = metroConfig.projectRoot || process.cwd();

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

  // Enhanced metro config
  const enhancedConfig: ConfigT = {
    ...metroConfig,
    transformer: {
      ...metroConfig.transformer,
      babelTransformerPath: require.resolve('./zephyr-transformer'),
      // Pass Zephyr options to transformer
      additionalTransforms: [
        ...(metroConfig.transformer?.additionalTransforms || []),
        {
          transform: require.resolve('./zephyr-transformer'),
          filter: () => true, // Apply to all files initially, filter in transformer
          options: {
            zephyr_engine,
            zephyrOptions,
            resolved_dependencies,
          },
        },
      ],
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
      enhanceMiddleware: (middleware, server) => {
        // Add zephyr-manifest.json endpoint
        server.app?.use('/zephyr-manifest.json', async (req, res) => {
          try {
            const manifestContent = createManifestContent(resolved_dependencies || []);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-cache');
            res.send(manifestContent);
          } catch (error) {
            logFn('error', `Failed to serve manifest: ${error}`);
            res.status(500).send({ error: 'Failed to generate manifest' });
          }
        });

        // Call original middleware enhancer if it exists
        if (metroConfig.server?.enhanceMiddleware) {
          return metroConfig.server.enhanceMiddleware(middleware, server);
        }
        return middleware;
      },
    },
  };

  // Generate manifest file for production builds
  await generateManifestFile(projectRoot, resolved_dependencies || []);

  logFn('info', 'Zephyr Metro plugin configured successfully');
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

/** Generate zephyr-manifest.json file */
async function generateManifestFile(
  projectRoot: string,
  resolved_dependencies: any[]
): Promise<void> {
  try {
    const manifestContent = createManifestContent(resolved_dependencies);
    const manifestPath = path.join(projectRoot, 'assets', 'zephyr-manifest.json');

    // Ensure assets directory exists
    const assetsDir = path.dirname(manifestPath);
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    await fs.promises.writeFile(manifestPath, manifestContent, 'utf-8');
    logFn('info', `Generated manifest at: ${manifestPath}`);
  } catch (error) {
    logFn('error', `Failed to generate manifest file: ${error}`);
  }
}

/** Legacy function name for backward compatibility */
export const withZephyrMetro = withZephyr;
