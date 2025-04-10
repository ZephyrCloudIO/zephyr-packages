import { sep } from 'node:path';
// import { Chunk, Compiler, Stats, StatsChunk, StatsCompilation } from 'webpack';
import { ConvertedGraph, ZeUploadBuildStats } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrEngine } from 'zephyr-agent';
import {
  convertToGraph,
  ConvertToGraphParams,
} from '../convert-to-graph/convert-to-graph';
import { TopLevelPackage } from '../convert-to-graph/validate-params';
import { findPackageJson } from './find-package-json';
import { computeVersionStrategy, gitSha } from './compute-version-strategy';
import { FederationDashboardPluginOptions } from './federation-dashboard-plugin-options';
import { AddRuntimeRequirementToPromiseExternal } from './add-runtime-requirement-to-promise-external';
import { Exposes } from './federation-dashboard-types';
import { isModuleFederationPlugin } from '../../../xpack-extract/is-module-federation-plugin';
import {
  XChunk,
  XCompiler,
  XStats,
  XStatsChunk,
  XStatsCompilation,
  ModuleFederationPlugin,
} from 'zephyr-edge-contract';

// TODO: convert this require to imports
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AutomaticVendorFederation = require('@module-federation/automatic-vendor-federation');

interface ProcessWebpackGraphParams {
  stats: XStats;
  stats_json: XStatsCompilation;
  pluginOptions: {
    zephyr_engine: ZephyrEngine;
    mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
    // Repack specific options because there are different targets it build towards
    target?: 'ios' | 'android' | 'web' | undefined;
  };
}

export class FederationDashboardPlugin {
  _options: FederationDashboardPluginOptions;
  _dashData: string | undefined;
  allArgumentsUsed: [file: string, applicationID: string, name: string][] = [];

  FederationPluginOptions: {
    name?: string;
    remotes?: unknown;
    /**
     * **bundle_name**: This is a placeholder option since Repack is fast iterating on
     * Module Federation, right now they are consuming JS bundle and ignore
     * mf-manifest.json, but if it comes back this field will be needed to understand what
     * bundle name to look for in mf-manifest.json, Available in
     * ApplicationVersion.metadata.
     */
    bundle_name?: string;
    filename?: string;
    exposes?: Exposes;
  } = {};

  // { filename: string; reportFunction: () => void }
  constructor(options: Partial<FederationDashboardPluginOptions>) {
    this._options = Object.assign(
      {
        debug: false,
        useAST: false,
      },
      options
    ) as FederationDashboardPluginOptions;
  }

  /** @param {Compiler} compiler */
  apply(compiler: XCompiler): void {
    // todo: use buildid version (user_build_count)
    compiler.options.output.uniqueName = `v${Date.now()}`;

    new AddRuntimeRequirementToPromiseExternal().apply(compiler);

    const FederationPlugin = compiler.options.plugins.find(isModuleFederationPlugin);

    // todo: valorkin fixes
    this._options.standalone = typeof FederationPlugin === 'undefined';

    if (FederationPlugin) {
      this.FederationPluginOptions = Object.assign(
        {},
        FederationPlugin._options,
        this._options.standalone || {}
      );
    } else if (this._options.standalone) {
      this.FederationPluginOptions = {};
    } else {
      throw new Error(
        'Dashboard plugin is missing Module Federation or standalone option'
      );
    }

    // if (this.FederationPluginOptions) {
    //   this.FederationPluginOptions.name =
    //     this.FederationPluginOptions?.name?.replace('__REMOTE_VERSION__', '');
    //   compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
    //     compilation.hooks.processAssets.tapPromise(
    //       {
    //         name: PLUGIN_NAME,
    //         stage: Compilation.PROCESS_ASSETS_STAGE_REPORT
    //       },
    //       () => this.processWebpackGraph(compilation)
    //     );
    //   });
    // }

    // todo: valorkin find usage of this env variables
    // if (this.FederationPluginOptions?.name) {
    //   new DefinePlugin({
    //     'process.dashboardURL': JSON.stringify(this._options.dashboardURL),
    //     'process.CURRENT_HOST': JSON.stringify(
    //       this.FederationPluginOptions.name
    //     )
    //   }).apply(compiler);
    // }
  }

  /*parseModuleAst(compilation: Compilation, callback?: () => void): void {
    const filePaths: { resource: string; file?: string }[] = [];
    const allArgumentsUsed: string[][] = [];
    // Explore each chunk (build output):
    compilation.chunks.forEach((chunk) => {
      // Explore each module within the chunk (built inputs):
      chunk.getModules().forEach(
        (
          module: Module & {
            resource?: string;
            resourceResolveData?: { relativePath: string };
          }
        ) => {
          // Loop through all the dependencies that has the named export that we are looking for
          const matchedNamedExports = module.dependencies.filter(
            (dep: Dependency & { name?: string }) =>
              dep.name === 'federateComponent'
          );

          if (matchedNamedExports.length > 0 && module.resource) {
            filePaths.push({
              resource: module.resource,
              file: module.resourceResolveData?.relativePath,
            });
          }
        }
      );

      filePaths.forEach(({ resource, file }) => {
        const sourceCode = readFileSync(resource).toString('utf-8');
        const ast = parse(sourceCode, {
          sourceType: 'unambiguous',
          plugins: ['jsx', 'typescript'],
        });

        // traverse the abstract syntax tree
        traverse(ast, {
          /!**
           * We want to run a function depending on a found nodeType
           * More node types are documented here: https://babeljs.io/docs/en/babel-types#api
           *!/
          CallExpression: (path) => {
            const { node } = path;
            const { callee, arguments: args } = node;

            if (callee?.loc?.identifierName === 'federateComponent') {
              const argsAreStrings = args.every(
                (arg) => arg.type === 'StringLiteral'
              );
              if (!argsAreStrings) {
                return;
              }
              const argsValue: (string | undefined)[] = [file];

              // we collect the JS representation of each argument used in this function call
              for (let i = 0; i < args.length; i++) {
                const a = args[i];
                let { code } = generate(a);

                if (code.startsWith('{')) {
                  // wrap it in parentheses, so when it's eval-ed, it is eval-ed correctly into an JS object
                  code = `(${code})`;
                }

                const value = eval(code);

                // If the value is a Node, that means it was a variable name
                // There is no easy way to resolve the variable real value, so we just skip any function calls
                // that has variable as its args
                if (isNode(value)) {
                  // by breaking out of the loop here,
                  // we also prevent this args to be pushed to `allArgumentsUsed`
                  break;
                } else {
                  argsValue.push(value);
                }

                if (i === args.length - 1) {
                  // push to the top level array

                  allArgumentsUsed.push(argsValue.filter(Boolean) as string[]);
                }
              }
            }
          },
        });
      });
    });

    const uniqueArgs = allArgumentsUsed.reduce(
      (acc, current) => {
        const id = current.join('|');
        acc[id] = current as [
          file: string,
          applicationID: string,
          name: string,
        ];
        return acc;
      },
      {} as Record<string, [file: string, applicationID: string, name: string]>
    );
    this.allArgumentsUsed = Object.values(uniqueArgs);
    if (callback) callback();
  }*/

  processWebpackGraph({
    stats,
    stats_json,
    pluginOptions,
  }: ProcessWebpackGraphParams): ConvertedGraph | undefined {
    // async processWebpackGraph(/*curCompiler: Compilation*/): Promise<unknown> {
    //   const stats = curCompiler.getStats();
    //   const stats_json = stats.toJson();
    //   if (this._options.useAST) {
    //     this.parseModuleAst(curCompiler);
    //   }

    // fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2))
    this.FederationPluginOptions = Object.assign(
      {},
      this.FederationPluginOptions,
      pluginOptions.mfConfig
    );

    // get RemoteEntryChunk
    const RemoteEntryChunk = this.getRemoteEntryChunk(
      stats_json,
      this.FederationPluginOptions
    );
    const validChunkArray = this.buildValidChunkArray(
      stats,
      this.FederationPluginOptions
    );
    const chunkDependencies = this.getChunkDependencies(validChunkArray);
    const vendorFederation = this.buildVendorFederationMap(stats);

    // TODO: this type casting might not be every compilation result from rspack, but it's fine for now
    const getPlatformFromStats = stats.compilation
      .name as FederationDashboardPluginOptions['target'];

    const remotes = this.FederationPluginOptions?.remotes
      ? Object.keys(this.FederationPluginOptions.remotes)
      : {};

    const rawData: ConvertToGraphParams = {
      name: this.FederationPluginOptions?.name,
      filename: this.FederationPluginOptions?.filename || '',
      remotes: remotes,
      metadata:
        Object.assign(
          {},
          this._options.metadata,
          this.attach_remote_bundle_name_to_metadata()
        ) || {},
      topLevelPackage: vendorFederation || {},
      publicPath: stats_json.publicPath,
      federationRemoteEntry: RemoteEntryChunk,
      buildHash: stats_json.hash,
      environment: this._options.environment || 'development', // 'development' if not specified
      version: computeVersionStrategy(stats_json, this._options.versionStrategy),
      posted: this._options.posted || new Date(), // Date.now() if not specified
      group: this._options.group || 'default', // 'default' if not specified
      sha: gitSha,
      modules: stats_json.modules,
      chunkDependencies,
      functionRemotes: this.allArgumentsUsed,
      target: pluginOptions.target || getPlatformFromStats,
    };

    let graphData: ConvertedGraph | undefined;
    try {
      graphData = convertToGraph(rawData /*, !!this._options.standalone*/);
    } catch (err) {
      console.warn('Error during dashboard data processing');
      console.warn(err);
    }

    if (!graphData) {
      return;
    }
    return graphData;
    // const dashData = (this._dashData = JSON.stringify(graphData));
    // return this.postDashboardData(graphData);
    // todo: this was generating dashboard plugin, not sure we need it anymore
    /*return Promise.resolve().then(() => {
      const statsBuf = Buffer.from(dashData || '{}', 'utf-8');

      const source: Source = {
        source() {
          return statsBuf;
        },
        size() {
          return statsBuf.length;
        }
      };
      // for dashboard.json
      if (curCompiler.emitAsset && this._options.filename) {
        const asset = curCompiler.getAsset(this._options.filename);
        if (asset) {
          curCompiler.updateAsset(this._options.filename, source as never);
        } else {
          curCompiler.emitAsset(this._options.filename, source as never);
        }
      }
      // for versioned remote
      if (
        curCompiler.emitAsset &&
        this.FederationPluginOptions.filename &&
        Object.keys(this.FederationPluginOptions.exposes || {}).length !== 0
      ) {
        const remoteEntry = curCompiler
          .getAsset(this.FederationPluginOptions.filename) as Asset & { source: { _value?: string } };
        const cleanVersion =
          typeof rawData.version === 'string'
            ? `_${rawData.version.split('.').join('_')}`
            : `_${rawData.version}`;

        let codeSource;
        if (
          remoteEntry &&
          !remoteEntry.source._value &&
          remoteEntry.source.source
        ) {
          codeSource = remoteEntry.source.source();
        } else if (remoteEntry.source._value) {
          codeSource = remoteEntry.source._value;
        }

        if (!codeSource) {
          return callback && callback();
        }

        //string replace "dsl" with version_dsl to make another global.
        const newSource = codeSource
          .toString()
          .replace(new RegExp(`__REMOTE_VERSION__`, 'g'), cleanVersion);

        const rewriteTempalteFromMain = codeSource
          .toString()
          .replace(new RegExp(`__REMOTE_VERSION__`, 'g'), '');

        const remoteEntryBuffer = Buffer.from(newSource, 'utf-8');
        const originalRemoteEntryBuffer = Buffer.from(
          rewriteTempalteFromMain,
          'utf-8'
        );

        const remoteEntrySource = new RawSource(remoteEntryBuffer);

        const originalRemoteEntrySource = new RawSource(
          originalRemoteEntryBuffer
        );

        if (remoteEntry && graphData?.version) {
          curCompiler.updateAsset(
            this.FederationPluginOptions.filename,
            originalRemoteEntrySource
          );

          curCompiler.emitAsset(
            [graphData.version, this.FederationPluginOptions.filename].join(
              '.'
            ),
            remoteEntrySource
          );
        }
      }
      if (callback) {
        return void callback();
      }
    });*/
  }

  // TODO: add notes on why we need these and what does these do
  getRemoteEntryChunk(
    stats: XStatsCompilation,
    FederationPluginOptions: typeof this.FederationPluginOptions
  ): XStatsChunk | undefined {
    if (!stats.chunks) return;

    // TODO: print all chunk name and see if it has the bundle name or actual remote name. in Rspack this field would return in remote application but won't return in host application due to Rspack's data structure - need external PR to fix
    return stats.chunks.find((chunk) =>
      chunk.names?.find((name) => name === FederationPluginOptions.name)
    );
  }

  /**
   * TODO: needs a full rewrite because `_group` no longer exists in both Rspack and
   * Webpack
   *
   * Return { "main": [{...dep1Details}, {...dep2Details}], "vendor": [{...dep3Details}],
   *
   * 1. Useful for dynamic imports - object generated could inform the bundler or runtime
   *    loader about which chunks are needed for specific part of the app, enabling better
   *    performance optimization 1.1 if a chunk representing a React component dynamically
   *    loads, this dependency graph can help the runtime understand what other chunks
   *    need to be loaded alongside it.
   * 2. Optimized loading and caching: By mapping chunk dependencies, this function supports
   *    advanced optimizations like caching. Chunks that haven’t changed between builds
   *    can be cached separately, reducing the need for users to download unchanged code.
   *
   * }
   */
  getChunkDependencies(validChunkArray: XChunk[]): Record<string, never> {
    return validChunkArray.reduce(
      (acc, chunk) => {
        const subset = chunk.getAllReferencedChunks();
        const stringifiableChunk = Array.from(subset).map((sub) => {
          const cleanSet = Object.getOwnPropertyNames(sub).reduce(
            (acc, key) => {
              if (key === '_groups') return acc;
              return Object.assign(acc, { [key]: sub[key as keyof XChunk] });
            },
            {} as Record<
              keyof Omit<XChunk, '_groups'>,
              XChunk[keyof Omit<XChunk, '_groups'>]
            >
          );

          return this.mapToObjectRec(cleanSet);
        });

        return Object.assign(acc, {
          [`${chunk.id}`]: stringifiableChunk,
        });
      },
      {} as Record<string, never>
    );
  }

  buildVendorFederationMap(liveStats: XStats): TopLevelPackage {
    // calling it "vendor", it's actually npm dependencies
    const vendorFederation: TopLevelPackage = {};
    let packageJson;
    if (this._options.packageJsonPath) {
      // todo: wrap this is in try/catch
      packageJson = require(this._options.packageJsonPath);
    } else {
      const initialPath = liveStats.compilation.options.context?.split(sep);
      packageJson = findPackageJson(initialPath);
    }

    if (packageJson) {
      vendorFederation.dependencies = AutomaticVendorFederation({
        exclude: [],
        ignoreVersion: false,
        packageJson,
        // subPackages: this.directReasons(modules),
        shareFrom: ['dependencies'],
        ignorePatchversion: false,
      });
      vendorFederation.devDependencies = AutomaticVendorFederation({
        exclude: [],
        ignoreVersion: false,
        packageJson,
        // subPackages: this.directReasons(modules),
        shareFrom: ['devDependencies'],
        ignorePatchversion: false,
      });
      vendorFederation.optionalDependencies = AutomaticVendorFederation({
        exclude: [],
        ignoreVersion: false,
        packageJson,
        // subPackages: this.directReasons(modules),
        shareFrom: ['optionalDependencies'],
        ignorePatchversion: false,
      });
    }

    return vendorFederation;
  }

  // Clean up the Chunks to a clear object with keys
  mapToObjectRec(
    m:
      | Record<string, XChunk[keyof XChunk]>
      | Map<string, XChunk[keyof XChunk]>
      | XChunk[keyof XChunk][]
  ): Record<string, unknown> {
    const lo: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(m)) {
      if (value instanceof Map && value.size > 0) {
        lo[key] = this.mapToObjectRec(value);
      } else if (value instanceof Set && value.size > 0) {
        lo[key] = this.mapToObjectRec(Array.from(value));
      } else {
        lo[key] = value;
      }
    }
    return lo;
  }

  /**
   * In a remote application, this function is used to find all the chunks that are
   * referenced by the remote entry chunk It won't return anything from HostApp
   */
  buildValidChunkArray(
    liveStats: XStats,
    FederationPluginOptions: typeof this.FederationPluginOptions
  ): XChunk[] {
    if (!FederationPluginOptions.name) return [];

    const namedChunkRefs = liveStats.compilation.namedChunks.get(
      FederationPluginOptions.name
    );

    if (!namedChunkRefs) return [];

    const AllReferencedChunksByRemote = namedChunkRefs.getAllReferencedChunks();

    const validChunkArray: XChunk[] = [];
    for (const chunk of AllReferencedChunksByRemote) {
      if (chunk.id !== FederationPluginOptions.name) {
        validChunkArray.push(chunk);
      }
    }

    return validChunkArray;
  }

  /*directReasons(modules) {
    const directReasons = new Set();

    modules.forEach((module) => {
      if (module.reasons) {
        module.reasons.forEach((reason) => {
          if (reason.userRequest) {
            try {
              // grab user required package.json
              const subsetPackage = require(reason.userRequest +
                '/package.json');

              directReasons.add(subsetPackage);
            } catch (e) {
            }
          }
        });
      }
    });

    return Array.from(directReasons);
  }*/

  /**
   * We are doing this because the filename in React Native is the actual JS bundle, "How
   * we understand the filename is different in react native" - filename would be at the
   * end of the URL modified in get_mf_config.ts If we don't attach the remote bundle name
   * to metadata, we will have no track record of the actual bundle when we need it later
   * -- this is RePack specific.
   */
  attach_remote_bundle_name_to_metadata(): Record<string, string> | undefined {
    if (!this.FederationPluginOptions.exposes) {
      return;
    }
    // TODO: not sure if this error would break the build. Silently log it for now
    if (!this.FederationPluginOptions.bundle_name) {
      console.warn(ZeErrors.ERR_MF_CONFIG_MISSING_FILENAME);
      return;
    }

    return { remote_bundle_name: this.FederationPluginOptions.bundle_name };
  }

  async postDashboardData(): Promise<
    | {
        value: ZeUploadBuildStats;
      }
    | undefined
  > {
    throw new Error('not implemented, override it');
  }
}
