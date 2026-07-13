import type { InputOptions, NormalizedOutputOptions, OutputBundle } from 'rolldown';
import {
  handleGlobalError,
  zeBuildDashData,
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
  assertZephyrBuildTarget,
  type ZephyrBuildHooks,
  type ZephyrBuildTarget,
} from 'zephyr-agent';
import type {
  ZephyrBuildStats,
  ZephyrLegacyModuleFederationConfig,
  ZephyrModuleFederationBuildMetadata,
  ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';
import { cwd } from 'node:process';
import { getAssetsMap } from './internal/get-assets-map';

const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

export interface ZephyrRolldownPluginOptions {
  /** Zephyr build target, including the `tap-app` mini-app artifact family. */
  target?: ZephyrBuildTarget;
  hooks?: ZephyrBuildHooks;
  /** Every independently published Module Federation container in the snapshot. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  /** Build-stat metadata paired with every entry in `mfConfigs`. */
  federation?: ZephyrModuleFederationBuildMetadata[];
}

function getLegacyModuleFederationConfig(
  mfConfigs: readonly ZephyrModuleFederationConfig[] | undefined
): ZephyrLegacyModuleFederationConfig | undefined {
  const config = mfConfigs?.length === 1 ? mfConfigs[0] : undefined;
  if (
    !config ||
    typeof config.name !== 'string' ||
    !config.name.trim() ||
    typeof config.filename !== 'string' ||
    !config.filename.trim()
  ) {
    return undefined;
  }
  return config as ZephyrLegacyModuleFederationConfig;
}

function assertTapModuleFederationMetadata(
  target: ZephyrBuildTarget | undefined,
  mfConfigs: readonly ZephyrModuleFederationConfig[] | undefined,
  federation: readonly ZephyrModuleFederationBuildMetadata[] | undefined
): void {
  if (target !== 'tap-app') return;

  const metadataError = (message: string) =>
    new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `Rolldown tap-app Module Federation metadata is invalid: ${message}`,
    });
  if (!Array.isArray(mfConfigs) || mfConfigs.length === 0) {
    throw metadataError('mfConfigs must be a non-empty array.');
  }
  if (!Array.isArray(federation) || federation.length === 0) {
    throw metadataError('federation must be a non-empty array.');
  }
  if (mfConfigs.length !== federation.length) {
    throw metadataError(
      'mfConfigs and federation must contain the same number of entries.'
    );
  }

  const federationByName = new Map<string, ZephyrModuleFederationBuildMetadata>();
  const remotes = new Set<string>();
  for (const entry of federation) {
    if (typeof entry.name !== 'string' || !entry.name.trim()) {
      throw metadataError('every federation entry must have a non-empty name.');
    }
    if (typeof entry.remote !== 'string' || !entry.remote.trim()) {
      throw metadataError('every federation entry must have a non-empty remote.');
    }
    if (federationByName.has(entry.name) || remotes.has(entry.remote)) {
      throw metadataError('federation entries must not duplicate names or remotes.');
    }
    federationByName.set(entry.name, entry);
    remotes.add(entry.remote);
  }

  const names = new Set<string>();
  const filenames = new Set<string>();
  for (const config of mfConfigs) {
    if (typeof config.name !== 'string' || !config.name.trim()) {
      throw metadataError('every mfConfigs entry must have a non-empty name.');
    }
    if (typeof config.filename !== 'string' || !config.filename.trim()) {
      throw metadataError('every mfConfigs entry must have a non-empty filename.');
    }
    if (names.has(config.name) || filenames.has(config.filename)) {
      throw metadataError('mfConfigs entries must not duplicate names or filenames.');
    }
    if (federationByName.get(config.name)?.remote !== config.filename) {
      throw metadataError(
        `mfConfigs entry ${JSON.stringify(config.name)} must pair with a federation remote matching ${JSON.stringify(config.filename)}.`
      );
    }
    names.add(config.name);
    filenames.add(config.filename);
  }
}

function attachFederationBuildStats(
  buildStats: ZephyrBuildStats,
  federation: ZephyrModuleFederationBuildMetadata[] | undefined
): ZephyrBuildStats {
  if (federation === undefined) {
    return buildStats;
  }

  // The singular dashboard fields are meaningful only for one container. Clear them
  // for zero/multiple entries rather than exposing an arbitrary first target.
  const singleton = federation.length === 1 ? federation[0] : undefined;
  return {
    ...buildStats,
    federation,
    remote: singleton?.remote,
    mf_manifest: singleton?.mf_manifest,
    library_type: singleton?.library_type,
    exposes: singleton?.exposes,
    shared: singleton?.shared,
  };
}

export function withZephyr(options: ZephyrRolldownPluginOptions = {}) {
  if (options.target !== undefined) {
    assertZephyrBuildTarget(options.target, 'withZephyr({ target })');
  }
  assertTapModuleFederationMetadata(
    options.target,
    options.mfConfigs,
    options.federation
  );
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const hooks = options?.hooks;
  const target = options.target;
  const { mfConfigs, federation } = options;
  const mfConfig = getLegacyModuleFederationConfig(mfConfigs);

  return {
    name: 'with-zephyr',
    buildStart: async (inputOptions: InputOptions) => {
      const path_to_execution_dir = getInputFolder(inputOptions);
      zephyr_defer_create({
        builder: 'rolldown',
        context: path_to_execution_dir,
        target,
      });
    },
    buildEnd: async (error?: Error) => {
      if (!error) return;
      try {
        const zephyr_engine = await zephyr_engine_defer;
        if (zephyr_engine.hasActiveBuild !== false) {
          zephyr_engine.build_failed();
        }
      } catch (engineError: unknown) {
        handleGlobalError(engineError);
      }
    },
    writeBundle: async (_options: NormalizedOutputOptions, bundle: OutputBundle) => {
      let zephyr_engine: ZephyrEngine | undefined;
      let buildInProgress = false;
      try {
        zephyr_engine = await zephyr_engine_defer;
        // Options are user-owned arrays, so validate them again at publication in
        // case a build integration mutated them after plugin setup.
        assertTapModuleFederationMetadata(target, mfConfigs, federation);
        // create() has already allocated generation zero.
        buildInProgress = true;

        // TAP SDK paths are part of its signed artifact graph. Rolldown's output
        // directory is a local filesystem detail and must not become a snapshot prefix.
        if (zephyr_engine.env.target === 'tap-app') {
          zephyr_engine.buildProperties.baseHref = '';
        } else {
          zephyr_engine.buildProperties.baseHref = _options.dir;
        }

        // Start a new build
        await zephyr_engine.start_new_build();

        // Upload assets and finish the build
        await zephyr_engine.upload_assets({
          assetsMap: getAssetsMap(bundle),
          buildStats: attachFederationBuildStats(
            await zeBuildDashData(zephyr_engine),
            federation
          ),
          ...(mfConfig ? { mfConfig } : {}),
          ...(mfConfigs ? { mfConfigs } : {}),
          hooks,
        });

        // build_finished owns cleanup even when its logger fails.
        buildInProgress = false;
        await zephyr_engine.build_finished();
      } catch (error) {
        handleGlobalError(error);
      } finally {
        if (buildInProgress && zephyr_engine?.hasActiveBuild !== false) {
          zephyr_engine?.build_failed();
        }
      }
    },
  };
}
