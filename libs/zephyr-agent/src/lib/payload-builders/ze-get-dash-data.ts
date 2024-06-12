import { createSnapshotId, ZeApplicationConfig, ZephyrPluginOptions } from 'zephyr-edge-contract';

export function zeGetDashData({pluginOptions, appConfig}: GetDashDataOptions) {
  const {EDGE_URL} = appConfig;
  const version = createSnapshotId(pluginOptions);

  return {
    id: pluginOptions.application_uid,
    name: pluginOptions.app.name,
    edge: { url: EDGE_URL },
    app: Object.assign({}, pluginOptions.app, {
      buildId: pluginOptions.zeConfig.buildId,
    }),
    version,
    git: pluginOptions.git,
    context: {
      isCI: pluginOptions.isCI,
    },
    dependencies: [],
    devDependencies: [],
    optionalDependencies: [],
    metadata: {},
    overrides: [],
    consumes: [],
    modules: [],
    sha: pluginOptions.git.commit,
    // todo: @deprecate
    buildHash: pluginOptions.git.commit,
  }
}

export interface GetDashDataOptions {
  appConfig: ZeApplicationConfig,
  pluginOptions: ZephyrPluginOptions
}
