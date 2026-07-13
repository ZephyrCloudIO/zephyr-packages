import type { ZephyrEngine } from 'zephyr-agent';
import {
  resolveMfManifestPath,
  zeBuildDashData,
  ze_log,
  ZeErrors,
  ZephyrError,
} from 'zephyr-agent';
import type {
  ZephyrBuildStats,
  ZephyrModuleFederationBuildMetadata,
  ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';
import { extractFederatedConfig } from '../xpack-extract/extract-federation-config';
import {
  mergeModuleFederationBuildMetadata,
  mergeModuleFederationConfigs,
} from '../xpack-extract/federation-config-metadata';
import type { ModuleFederationPlugin, XStats, XStatsCompilation } from '../xpack.types';
import { FederationDashboardPlugin } from './utils/federation-dashboard-plugin/FederationDashboardPlugin';

interface KnownAgentProps {
  stats: XStats;
  stats_json: XStatsCompilation;
  pluginOptions: {
    zephyr_engine: ZephyrEngine;
    // federated module config
    mfConfig?: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  };
}

export type ModuleFederationBuildMetadata = ZephyrModuleFederationBuildMetadata;

interface FederationConfigEntry {
  plugin: ModuleFederationPlugin;
  config: NonNullable<ReturnType<typeof extractFederatedConfig>>;
}

function getFederationConfigEntries(
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined
): FederationConfigEntry[] {
  const plugins = mfConfig ? (Array.isArray(mfConfig) ? mfConfig : [mfConfig]) : [];

  return plugins.flatMap((plugin) => {
    const config = extractFederatedConfig(plugin);
    return config ? [{ plugin, config }] : [];
  });
}

/**
 * Produces snapshot-safe copies of every Module Federation config attached to a
 * compilation. The plugin wrappers contain functions and bundler internals; snapshot
 * metadata must retain only the serializable configuration bytes.
 */
export function getModuleFederationConfigs(
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined
): ZephyrModuleFederationConfig[] {
  return mergeModuleFederationConfigs([
    getFederationConfigEntries(mfConfig).map(
      ({ config }) => JSON.parse(JSON.stringify(config)) as ZephyrModuleFederationConfig
    ),
  ]);
}

/** Extracts the publication metadata needed to load an enhanced federation build. */
export function getModuleFederationBuildMetadata(
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined
): ModuleFederationBuildMetadata[] {
  return mergeModuleFederationBuildMetadata([
    getFederationConfigEntries(mfConfig).map(({ plugin, config }) => {
      // Enhanced MF plugins have an enumerable plugin name and emit the default manifest
      // when `manifest` is omitted. Native/legacy MF plugins do not emit an MF manifest.
      const emitsManifest =
        config.manifest !== undefined ||
        ('name' in plugin && typeof plugin.name === 'string');

      return {
        name: config.name,
        remote: config.filename,
        mf_manifest: emitsManifest ? resolveMfManifestPath(config.manifest) : undefined,
        library_type: config.library?.type ?? 'var',
        exposes: config.exposes,
        shared: config.shared,
      };
    }),
  ]);
}

export async function getBuildStats<ZephyrAgentProps extends KnownAgentProps>({
  stats,
  stats_json,
  pluginOptions,
  EDGE_URL,
  DOMAIN,
  PLATFORM,
  TYPE,
  DELIMITER: delimiter = undefined,
}: ZephyrAgentProps & {
  EDGE_URL: string;
  DOMAIN?: string;
  PLATFORM?: string;
  TYPE?: string;
  DELIMITER?: string;
}): Promise<ZephyrBuildStats> {
  ze_log.app('get build stats started. create federation dashboard plugin');
  const ze_engine = pluginOptions.zephyr_engine;
  const app = ze_engine.applicationProperties;
  const { git } = ze_engine.gitProperties;
  const context = ze_engine.env;

  const version = await ze_engine.snapshotId;
  const application_uid = ze_engine.application_uid;
  const buildId = await ze_engine.build_id;
  const build_target = ze_engine.env.target ?? 'web';

  const federation = getModuleFederationBuildMetadata(pluginOptions.mfConfig);
  // The former singular fields remain for existing dashboard consumers, but selecting
  // an arbitrary first config for a multi-container build would make the published
  // metadata lie. New consumers read the complete `federation` array.
  const legacyFederation = federation.length === 1 ? federation[0] : undefined;
  const legacyFederationFields = legacyFederation ?? {
    name: app.name,
    remote: undefined,
    mf_manifest: undefined,
    library_type: undefined,
    exposes: undefined,
    shared: undefined,
  };
  const remotes = ze_engine.federated_dependencies;
  const data_overrides = {
    id: application_uid,
    ...legacyFederationFields,
    federation,
    edge: { url: EDGE_URL, delimiter },
    domain: DOMAIN,
    platform: PLATFORM,
    type: TYPE ?? 'app',
    app: Object.assign({}, app, { buildId }),
    version,
    git,
    remotes: remotes?.map(({ application_uid }) => application_uid) ?? [],
    context,
    build_target,
    zephyrDependencies: ze_engine.zephyr_dependencies,
  };

  if (build_target === 'tap-app') {
    // The legacy dashboard graph was built around one container and historically
    // rewrote/guessed graph state. TAP publication needs an immutable artifact envelope,
    // so use the generic typed dash-data path and layer only the exact MF metadata onto
    // it. This also keeps a multi-target package independent of legacy graph heuristics.
    const baseline = await zeBuildDashData(ze_engine);
    const tapBuildStats = {
      ...baseline,
      ...data_overrides,
      project: legacyFederation?.name ?? app.name,
      tags: baseline.tags ?? [],
    } as ZephyrBuildStats;
    ze_log.app('get tap-app build stats done.', tapBuildStats);
    return tapBuildStats;
  }

  const dashboardPlugin = new FederationDashboardPlugin({
    app,
    git,
    context,
  });

  ze_log.app('process webpack graph.pluginOptions', pluginOptions);
  const convertedGraph = dashboardPlugin.processWebpackGraph({
    stats,
    stats_json,
    pluginOptions,
  });

  if (!convertedGraph) {
    throw new ZephyrError(ZeErrors.ERR_CONVERT_GRAPH_TO_DASHBOARD);
  }

  const res = Object.assign({}, convertedGraph, data_overrides, {
    project: legacyFederation?.name ?? app.name, // Add missing project property
    tags: [], // Add missing tags property with empty array as default
  }) as ZephyrBuildStats;
  ze_log.app('get build stats done.', res);
  return res;
}
