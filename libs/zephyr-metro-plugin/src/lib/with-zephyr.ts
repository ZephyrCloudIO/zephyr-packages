import type { ConfigT } from 'metro-config';
import { ze_log, ZephyrEngine, ZephyrError, createManifestContent } from 'zephyr-agent';
import path from 'path';
import fs from 'fs';

export interface ZephyrMetroOptions {
  /** Application name */
  name?: string;
  /** Remote dependencies configuration */
  remotes?: Record<string, string>;
  /** Target platform */
  target?: 'ios' | 'android';
  /** Enable OTA updates */
  enableOTA?: boolean;
  /** Application UID for OTA */
  applicationUid?: string;
  /** OTA configuration */
  otaConfig?: {
    checkInterval?: number;
    debug?: boolean;
  };
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
      ze_log.error(ZephyrError.format(error));
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
        // Add zephyr-manifest.json endpoint
        server.app?.use('/zephyr-manifest.json', async (req: any, res: any) => {
          try {
            let manifestContent = createManifestContent(resolved_dependencies || []);

            // Enhance with OTA metadata if enabled
            if (zephyrOptions.enableOTA) {
              const manifest = JSON.parse(manifestContent);
              manifest.ota_enabled = true;
              manifest.application_uid = zephyrOptions.applicationUid;
              manifest.timestamp = new Date().toISOString();
              manifestContent = JSON.stringify(manifest, null, 2);
            }

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-cache');
            res.send(manifestContent);
          } catch (error) {
            ze_log.error(`Failed to serve manifest: ${error}`);
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

  // Generate manifest file for production builds (enhanced with OTA if enabled)
  await generateManifestFile(projectRoot, resolved_dependencies || [], zephyrOptions);

  // Log OTA configuration if enabled
  if (zephyrOptions.enableOTA) {
    ze_log.app('Zephyr Metro plugin configured with OTA support');
    ze_log.app(`App UID: ${zephyrOptions.applicationUid || 'not specified'}`);
  } else {
    ze_log.app('Zephyr Metro plugin configured successfully');
  }

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
  resolved_dependencies: any[],
  zephyrOptions: ZephyrMetroOptions
): Promise<void> {
  try {
    let manifestContent = createManifestContent(resolved_dependencies);

    // Enhance manifest with OTA metadata if OTA is enabled
    if (zephyrOptions.enableOTA) {
      const manifest = JSON.parse(manifestContent);
      manifest.ota_enabled = true;
      manifest.application_uid = zephyrOptions.applicationUid;
      manifest.timestamp = new Date().toISOString();
      manifestContent = JSON.stringify(manifest, null, 2);
    }

    const manifestPath = path.join(projectRoot, 'assets', 'zephyr-manifest.json');

    // Ensure assets directory exists
    const assetsDir = path.dirname(manifestPath);
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    await fs.promises.writeFile(manifestPath, manifestContent, 'utf-8');

    if (zephyrOptions.enableOTA) {
      ze_log.manifest(`Generated OTA-enhanced manifest at: ${manifestPath}`);
    } else {
      ze_log.manifest(`Generated manifest at: ${manifestPath}`);
    }
  } catch (error) {
    ze_log.error(`Failed to generate manifest file: ${error}`);
  }
}

/** Legacy function name for backward compatibility */
export const withZephyrMetro = withZephyr;
