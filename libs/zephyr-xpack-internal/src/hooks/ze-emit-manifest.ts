import { createManifestContent, ze_log, type ZephyrEngine } from 'zephyr-agent';

interface EmitManifestOptions {
  pluginName: string;
  zephyr_engine: ZephyrEngine;
}

interface EmitManifestCompiler {
  webpack: {
    sources: { RawSource: new (source: string | Buffer) => any };
    Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: number };
  };
  hooks: {
    thisCompilation: {
      tap: (
        pluginName: string,
        cb: (compilation: EmitManifestCompilation) => void
      ) => void;
    };
  };
}

interface EmitManifestCompilation {
  hooks: {
    processAssets: {
      tapPromise: (
        options: { name: string; stage: number },
        cb: (assets: Record<string, any>) => Promise<void>
      ) => void;
    };
  };
  emitAsset: (filename: string, source: any) => void;
}

/**
 * Emits the zephyr-manifest.json file during the build process This ensures the manifest
 * is available for local development and production Includes both federated dependencies
 * and environment variables
 */
export function setupManifestEmission<
  T extends EmitManifestOptions,
  XCompiler extends EmitManifestCompiler,
>(pluginOptions: T, compiler: XCompiler): void {
  const { pluginName, zephyr_engine } = pluginOptions;
  const { RawSource } = compiler.webpack.sources;

  compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
    compilation.hooks.processAssets.tapPromise(
      {
        name: `${pluginName}:EmitManifest`,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
      },
      async () => {
        // Always emit manifest, even without federated dependencies
        // This ensures environment variables are always available
        const dependencies = zephyr_engine.federated_dependencies || [];

        // Convert to JSON with environment variables included
        const manifestContent = createManifestContent(dependencies, true);

        // Emit the asset
        compilation.emitAsset('zephyr-manifest.json', new RawSource(manifestContent));

        ze_log.manifest('[Zephyr Manifest] Emitted with:', {
          dependencies: dependencies.length,
          hasEnvVars: manifestContent.includes('zeVars'),
        });
      }
    );
  });
}
