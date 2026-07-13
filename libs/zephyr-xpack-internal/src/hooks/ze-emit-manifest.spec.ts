import { describe, expect, it, rs } from '@rstest/core';
import { ZEPHYR_MANIFEST_FILENAME } from 'zephyr-agent';
import { setupManifestEmission } from './ze-emit-manifest';

function setupCompiler(existingAsset?: unknown) {
  const processAssets = {
    tapPromise: rs.fn(),
  };
  const compilation = {
    getAsset: rs.fn().mockReturnValue(existingAsset),
    emitAsset: rs.fn(),
    hooks: { processAssets },
  };
  const compiler = {
    webpack: {
      sources: {
        RawSource: class RawSource {
          constructor(readonly content: string | Buffer) {}
        },
      },
      Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: 1 },
    },
    hooks: {
      thisCompilation: {
        tap: rs.fn((_: string, callback: (value: typeof compilation) => void) => {
          callback(compilation);
        }),
      },
    },
  };

  setupManifestEmission(
    {
      pluginName: 'ZephyrTestPlugin',
      zephyr_engine: { federated_dependencies: [] } as never,
    },
    compiler
  );

  const callback = processAssets.tapPromise.mock.calls[0]?.[1] as () => Promise<void>;
  return { callback, compilation, processAssets };
}

describe('setupManifestEmission', () => {
  it('preserves a TAP SDK-emitted content-locked manifest', async () => {
    const existing = { name: ZEPHYR_MANIFEST_FILENAME };
    const { callback, compilation } = setupCompiler(existing);

    await callback();

    expect(compilation.getAsset).toHaveBeenCalledWith(ZEPHYR_MANIFEST_FILENAME);
    expect(compilation.emitAsset).not.toHaveBeenCalled();
  });

  it('emits the normal Zephyr manifest when no artifact owns that path', async () => {
    const { callback, compilation } = setupCompiler();

    await callback();

    expect(compilation.emitAsset).toHaveBeenCalledWith(
      ZEPHYR_MANIFEST_FILENAME,
      expect.anything()
    );
  });
});
