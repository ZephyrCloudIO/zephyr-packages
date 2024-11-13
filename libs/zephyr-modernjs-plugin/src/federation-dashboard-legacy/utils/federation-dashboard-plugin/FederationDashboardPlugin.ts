import { sep } from 'node:path';
import { Chunk, Compiler, container, Stats, StatsChunk, StatsCompilation } from 'webpack';
import {
  ConvertedGraph,
  ZeUploadBuildStats,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';

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
import { isModuleFederationPlugin } from '../../../lib/utils/is-mf-plugin';
// convert this require to imports

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AutomaticVendorFederation = require('@module-federation/automatic-vendor-federation');

type ModuleFederationPlugin = typeof container.ModuleFederationPlugin;
type ModuleFederationPluginOptions = ConstructorParameters<ModuleFederationPlugin>[0];

interface ProcessWebpackGraphParams {
  stats: Stats;
  stats_json: StatsCompilation;
  pluginOptions: ZephyrPluginOptions;
}

export class FederationDashboardPlugin {
  _options: FederationDashboardPluginOptions;
  _dashData: string | undefined;
  allArgumentsUsed: [file: string, applicationID: string, name: string][] = [];

  FederationPluginOptions: {
    name?: string;
    remotes?: unknown;
    // filename?: string;
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
  apply(compiler: Compiler): void {
    // todo: use buildid version (user_build_count)
    compiler.options.output.uniqueName = `v${Date.now()}`;

    new AddRuntimeRequirementToPromiseExternal().apply(compiler);

    const FederationPlugin = compiler.options.plugins.find(
      isModuleFederationPlugin
    ) as ModuleFederationPlugin & {
      _options: ModuleFederationPluginOptions;
    };

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

    const rawData: ConvertToGraphParams = {
      name: this.FederationPluginOptions?.name,
      remotes: Object.keys(this.FederationPluginOptions?.remotes || {}),
      metadata: this._options.metadata || {},
      topLevelPackage: vendorFederation || {},
      publicPath: stats_json.publicPath,
      federationRemoteEntry: RemoteEntryChunk,
      buildHash: stats_json.hash,
      environment: this._options.environment, // 'development' if not specified
      version: computeVersionStrategy(stats_json, this._options.versionStrategy),
      posted: this._options.posted, // Date.now() if not specified
      group: this._options.group, // 'default' if not specified
      sha: gitSha,
      modules: stats_json.modules,
      chunkDependencies,
      functionRemotes: this.allArgumentsUsed,
    };

    let graphData: ConvertedGraph | undefined;
    try {
      graphData = convertToGraph(rawData, !!this._options.standalone);
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

  getRemoteEntryChunk(
    stats: StatsCompilation,
    FederationPluginOptions: typeof this.FederationPluginOptions
  ): StatsChunk | undefined {
    if (!stats.chunks) return;

    return stats.chunks.find((chunk) =>
      chunk.names?.find((name) => name === FederationPluginOptions.name)
    );
  }

  getChunkDependencies(validChunkArray: Chunk[]): Record<string, never> {
    return validChunkArray.reduce(
      (acc, chunk) => {
        const subset = chunk.getAllReferencedChunks();
        const stringifiableChunk = Array.from(subset).map((sub) => {
          const cleanSet = Object.getOwnPropertyNames(sub).reduce(
            (acc, key) => {
              if (key === '_groups') return acc;
              return Object.assign(acc, { [key]: sub[key as keyof Chunk] });
            },
            {} as Record<
              keyof Omit<Chunk, '_groups'>,
              Chunk[keyof Omit<Chunk, '_groups'>]
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

  buildVendorFederationMap(liveStats: Stats): TopLevelPackage {
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

  mapToObjectRec(
    m:
      | Record<string, Chunk[keyof Chunk]>
      | Map<string, Chunk[keyof Chunk]>
      | Chunk[keyof Chunk][]
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

  buildValidChunkArray(
    liveStats: Stats,
    FederationPluginOptions: typeof this.FederationPluginOptions
  ): Chunk[] {
    if (!FederationPluginOptions.name) return [];

    const namedChunkRefs = liveStats.compilation.namedChunks.get(
      FederationPluginOptions.name
    );

    if (!namedChunkRefs) return [];
    const AllReferencedChunksByRemote = namedChunkRefs.getAllReferencedChunks();

    const validChunkArray: Chunk[] = [];
    AllReferencedChunksByRemote.forEach((chunk) => {
      if (chunk.id !== FederationPluginOptions.name) {
        validChunkArray.push(chunk);
      }
    });

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

  async postDashboardData(
    dashData: any
  ): Promise<{ value: ZeUploadBuildStats } | undefined> {
    console.log(dashData);
    throw new Error('not implemented, override it');
  }
}
