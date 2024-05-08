import {
  NormalizedOutputOptions,
  OutputAsset,
  OutputBundle,
  OutputChunk,
} from 'rollup';
import {
  createFullAppName,
  createSnapshotId,
  ze_error,
  ze_log,
  ZeBuildAssetsMap,
} from 'zephyr-edge-contract';
import {
  checkAuth,
  createSnapshot,
  getApplicationConfiguration,
  getBuildId,
  getGitInfo,
  getPackageJson,
  getZeBuildAsset,
  logger,
  zeEnableSnapshotOnEdge,
  zeUploadAssets,
  zeUploadBuildStats,
  zeUploadSnapshot,
} from 'zephyr-agent';

export function withZephyr() {
  return {
    name: 'with-zephyr',
    writeBundle: async (
      options: NormalizedOutputOptions,
      bundle: OutputBundle
    ) => {
      const isCI = false;
      const _zephyrOptions = { wait_for_index_html: false };
      const path_to_execution_dir = options.dir;
      const assets = bundle;

      /* hacks end */

      ze_log('Configuring with Zephyr');
      const packageJson = getPackageJson(path_to_execution_dir);
      ze_log('Loaded Package JSON', packageJson);
      if (!packageJson) return ze_error('Could not find package json');

      const gitInfo = getGitInfo();
      ze_log('Loaded Git Info', gitInfo);
      if (
        !gitInfo ||
        !gitInfo?.app.org ||
        !gitInfo?.app.project ||
        !packageJson?.name
      )
        return ze_error('Could not get git info');

      const application_uid = createFullAppName({
        org: gitInfo.app.org,
        project: gitInfo.app.project,
        name: packageJson?.name,
      });

      ze_log('Going to check auth token or get it');
      await checkAuth();

      ze_log('Got auth token, going to get application configuration');
      const { username, email, EDGE_URL } = await getApplicationConfiguration({
        application_uid,
      });

      ze_log('Got application configuration', { username, email, EDGE_URL });

      ze_log('Going to get build id');
      const buildId = await getBuildId(application_uid).catch((err: Error) => {
        logEvent({
          level: 'error',
          action: 'build:get-build-id:error',
          message: `error receiving build number for '${email}'\n
        ${err.message}\n`,
        });
      });
      if (!buildId) return ze_error('[zephyr]: Could not get build id');

      const pluginOptions = {
        pluginName: 'rollup-plugin-zephyr',
        application_uid,
        // todo: isCI
        buildEnv: 'local',
        username,
        app: {
          name: packageJson.name,
          version: packageJson.version,
          org: gitInfo.app.org,
          project: gitInfo.app.project,
        },
        git: gitInfo?.git,
        isCI: isCI,
        zeConfig: {
          user: username,
          edge_url: EDGE_URL,
          buildId: buildId,
        },
        mfConfig: void 0,
        wait_for_index_html: _zephyrOptions?.wait_for_index_html,
      };

      ze_log('zephyr agent started.');
      const logEvent = logger(pluginOptions);

      const zeStart = Date.now();

      // const assetsMap = await zeBuildAssetsMap(pluginOptions, assets);
      ze_log('Building assets map from webpack assets.');

      const extractBuffer = (
        asset: OutputChunk | OutputAsset
      ): string | undefined => {
        switch (asset.type) {
          case 'chunk':
            return asset.code;
          case 'asset':
            return typeof asset.source === 'string'
              ? asset.source
              : new TextDecoder().decode(asset.source);
          default:
            return void 0;
        }
      };

      const getAssetType = (asset: OutputChunk | OutputAsset): string =>
        asset.type;

      const assetsMap = Object.keys(assets).reduce((memo, filepath) => {
        const asset = assets[filepath];
        const buffer = extractBuffer(asset);

        if (!buffer && buffer !== '') {
          logEvent({
            action: 'ze:build:assets:unknown-asset-type',
            level: 'error',
            message: `unknown asset type: ${getAssetType(asset)}`,
          });
          return memo;
        }

        const assetMap = getZeBuildAsset({ filepath, content: buffer });
        memo[assetMap.hash] = assetMap;

        return memo;
      }, {} as ZeBuildAssetsMap);

      const snapshot = createSnapshot({
        options: pluginOptions,
        assets: assetsMap,
        username,
        email,
      });

      const missingAssets = await zeUploadSnapshot(
        pluginOptions,
        snapshot
      ).catch((err) => ze_error('Failed to upload snapshot.', err));

      if (typeof missingAssets === 'undefined')
        return ze_error('Snapshot upload gave no result, exiting');

      const assetsUploadSuccess = await zeUploadAssets(pluginOptions, {
        missingAssets,
        assetsMap,
        count: Object.keys(assets).length,
      });

      if (!assetsUploadSuccess)
        return ze_error('Failed to upload assets.', assetsUploadSuccess);

      const version = createSnapshotId(pluginOptions);
      const dashData = {
        id: pluginOptions.application_uid,
        name: packageJson.name,
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
      };

      const envs = await zeUploadBuildStats(dashData);
      if (!envs)
        return ze_error(
          'Did not receive envs from build stats upload. Exiting.'
        );

      await zeEnableSnapshotOnEdge(pluginOptions, snapshot, envs.value);

      logEvent({
        level: 'info',
        action: 'build:deploy:done',
        message: `build deployed in ${Date.now() - zeStart}ms`,
      });
    },
  };
}
