import { createManifestContent, ze_log, type ZephyrEngine } from 'zephyr-agent';
import { ZEPHYR_MANIFEST_FILENAME } from 'zephyr-edge-contract';

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
 * is available for local development
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
        // Wait for dependencies to be resolved
        if (!zephyr_engine.federated_dependencies) {
          ze_log.snapshot('[Zephyr Manifest] No federated dependencies to emit');
          return;
        }

        // Convert to JSON
        const manifestContent = createManifestContent(
          zephyr_engine.federated_dependencies
        );

        // Emit the asset
        compilation.emitAsset(ZEPHYR_MANIFEST_FILENAME, new RawSource(manifestContent));
      }
    );
  });
}
