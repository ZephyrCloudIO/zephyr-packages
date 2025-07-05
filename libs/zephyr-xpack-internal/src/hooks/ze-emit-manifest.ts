import type { ZephyrEngine } from 'zephyr-agent';
import { createHash } from 'crypto';

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
          console.log('[Zephyr Manifest] No federated dependencies to emit');
          return;
        }

        // Create the manifest content
        const manifest = {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          dependencies: {} as Record<string, any>,
        };

        // Add dependencies to manifest
        zephyr_engine.federated_dependencies.forEach((dep) => {
          manifest.dependencies[dep.name] = {
            name: dep.name,
            application_uid: dep.application_uid,
            remote_entry_url: dep.remote_entry_url,
            default_url: dep.default_url,
          };
        });

        // Convert to JSON
        const manifestContent = JSON.stringify(manifest, null, 2);

        console.log('[Zephyr Manifest] Emitting zephyr-manifest.json to build output');
        console.log(`[Zephyr Manifest] Manifest size: ${manifestContent.length} bytes`);
        console.log(
          `[Zephyr Manifest] Dependencies: ${Object.keys(manifest.dependencies).join(', ')}`
        );

        // Emit the asset
        compilation.emitAsset('zephyr-manifest.json', new RawSource(manifestContent));
      }
    );
  });
}
