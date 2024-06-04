import { createSnapshotId, ZeApplicationConfig, ZephyrPluginOptions } from 'zephyr-edge-contract';

interface GetDashDataOptions {
  appConfig: ZeApplicationConfig,
  pluginOptions: ZephyrPluginOptions
}

export function getDashData({pluginOptions, appConfig}: GetDashDataOptions) {
  const {EDGE_URL} = appConfig;
  const version = createSnapshotId(pluginOptions);

  return {
    id: pluginOptions.application_uid,
      name: pluginOptions.app.name,
    // name: pluginOptions.mfConfig?.name,
    edge: { url: EDGE_URL },
    app: Object.assign({}, pluginOptions.app, {
      buildId: pluginOptions.zeConfig.buildId,
    }),
      version,
      git: pluginOptions.git,
    // remote: pluginOptions.mfConfig?.filename,
    // remotes: Object.keys(pluginOptions.mfConfig?.remotes || {}),
    context: {
    isCI: pluginOptions.isCI,
  },
    dependencies: [],
      devDependencies: [],
    optionalDependencies: [],
    metadata: {},
    overrides: [
      /* {
         "id": "react-dom",
         "name": "react-dom",
         "version": "18.2.0",
         "location": "react-dom",
         "applicationID": "react-dom"
       },
       {
         "id": "react",
         "name": "react",
         "version": "18.2.0",
         "location": "react",
         "applicationID": "react"
       }*/
    ],
      consumes: [],
    modules: [
    /*          {
                "id": "GreenRecos:GreenRecos",
                "name": "GreenRecos",
                "applicationID": "GreenRecos",
                "requires": [
                  "react"
                ],
                "file": "./src/app/team-green-recos.tsx"
              }*/
  ],
    sha: pluginOptions.git.commit,
    // todo: @deprecate
    buildHash: pluginOptions.git.commit,
  }
}
