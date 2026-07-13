/* eslint-disable no-restricted-syntax */

import { sep } from 'node:path';
import { ZeErrors, type ZephyrEngine } from 'zephyr-agent';
import type {
  ConvertedGraph,
  ZeUploadBuildStats,
  ZephyrBuildTarget,
} from 'zephyr-edge-contract';
import {
  extractFederatedConfig,
  isModuleFederationPlugin,
  parseRemotesAsEntries,
} from '../../../xpack-extract';
import type {
  ModuleFederationPlugin,
  XChunk,
  XCompiler,
  XFederatedRemotesConfig,
  XStats,
  XStatsChunk,
  XStatsCompilation,
} from '../../../xpack.types';
import {
  type ConvertToGraphParams,
  convertToGraph,
} from '../convert-to-graph/convert-to-graph';
import type { TopLevelPackage } from '../convert-to-graph/validate-params';
import { AddRuntimeRequirementToPromiseExternal } from './add-runtime-requirement-to-promise-external';
import { computeVersionStrategy, gitSha } from './compute-version-strategy';
import type { FederationDashboardPluginOptions } from './federation-dashboard-plugin-options';
import type { Exposes } from './federation-dashboard-types';
import { findPackageJson } from './find-package-json';

// The package ships no types and its module.exports is the function itself.
// In the ESM build the bundler rewrites this require() into a namespace import
// of the CJS module, which puts the callable on `.default`.
const avfModule = require('@module-federation/automatic-vendor-federation');
const AutomaticVendorFederation = avfModule?.default ?? avfModule;

interface ProcessWebpackGraphParams {
  stats: XStats;
  stats_json: XStatsCompilation;
  pluginOptions: {
    zephyr_engine: ZephyrEngine;
    mfConfig?: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
    // Repack specific options because there are different targets it build towards
    target?: ZephyrBuildTarget | undefined;
  };
}

interface FederationPluginOptions {
  name?: string;
  remotes?: XFederatedRemotesConfig['remotes'];
  /** See the Repack compatibility note on the class field. */
  bundle_name?: string;
  filename?: string;
  exposes?: Exposes;
}

export interface ResolvedFederationGraphConfiguration {
  /** Every independently emitted container represented by this compilation. */
  configurations: FederationPluginOptions[];
  /** The legacy graph has one owner, so multi-container builds use the application name. */
  graphConfiguration: FederationPluginOptions;
  /** Union of all remotes, without dropping containers after the first plugin. */
  remoteNames: string[];
}

/**
 * Converts bundler plugin wrappers into the serializable configuration needed by the
 * legacy graph. A multi-container compilation deliberately has no selected container: the
 * graph is attributed to the application and the per-container details are carried by the
 * build-stat `federation` array.
 */
export function resolveFederationGraphConfiguration(
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined,
  fallback: FederationPluginOptions,
  applicationName: string | undefined
): ResolvedFederationGraphConfiguration {
  const plugins = mfConfig ? (Array.isArray(mfConfig) ? mfConfig : [mfConfig]) : [];
  const configurations = plugins.flatMap((plugin) => {
    const config = extractFederatedConfig(plugin);
    return config ? [config] : [];
  });
  const resolvedConfigurations =
    configurations.length > 0
      ? configurations
      : Object.keys(fallback).length > 0
        ? [fallback]
        : [];
  const remoteNames = [
    ...new Set(
      resolvedConfigurations.flatMap((config) =>
        parseRemotesAsEntries(config.remotes).map(([remoteName]) => remoteName)
      )
    ),
  ];

  return {
    configurations: resolvedConfigurations,
    graphConfiguration:
      resolvedConfigurations.length === 1
        ? resolvedConfigurations[0]
        : { name: applicationName },
    remoteNames,
  };
}

export class FederationDashboardPlugin {
  _options: FederationDashboardPluginOptions;
  _dashData: string | undefined;
  allArgumentsUsed: [file: string, applicationID: string, name: string][] = [];

  FederationPluginOptions: FederationPluginOptions = {};

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
        extractFederatedConfig(FederationPlugin),
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
    const { configurations, graphConfiguration, remoteNames } =
      resolveFederationGraphConfiguration(
        pluginOptions.mfConfig,
        this.FederationPluginOptions,
        this._options.app?.name
      );
    // Preserve the singular field for existing callers only when it represents the
    // graph owner. Never assign an array into this object (which turns containers into
    // numeric keys and silently loses their configuration).
    this.FederationPluginOptions = graphConfiguration;

    // A single remote-entry chunk is a legacy graph field. Multi-container builds keep
    // their exact entries in buildStats.federation rather than pretending one was chosen.
    const remoteEntryChunk =
      configurations.length === 1
        ? this.getRemoteEntryChunk(stats_json, graphConfiguration)
        : undefined;
    const validChunkArray = Array.from(
      new Set(
        configurations.flatMap((configuration) =>
          this.buildValidChunkArray(stats, configuration)
        )
      )
    );
    const chunkDependencies = this.getChunkDependencies(validChunkArray);
    const vendorFederation = this.buildVendorFederationMap(stats);

    const getPlatformFromStats = stats.compilation
      .name as FederationDashboardPluginOptions['target'];

    const rawData: ConvertToGraphParams = {
      name: graphConfiguration.name,
      filename: graphConfiguration.filename || '',
      remotes: remoteNames,
      metadata:
        Object.assign(
          {},
          this._options.metadata,
          this.attach_remote_bundle_name_to_metadata(configurations)
        ) || {},
      topLevelPackage: vendorFederation || {},
      publicPath: stats_json.publicPath,
      federationRemoteEntry: remoteEntryChunk,
      buildHash: stats_json.hash,
      environment: this._options.environment || 'development', // 'development' if not specified
      version: computeVersionStrategy(stats_json, this._options.versionStrategy),
      posted: this._options.posted || new Date(), // Date.now() if not specified
      group: this._options.group || 'default', // 'default' if not specified
      sha: gitSha,
      modules: stats_json.modules,
      chunkDependencies,
      functionRemotes: this.allArgumentsUsed,
      target:
        pluginOptions.target ??
        pluginOptions.zephyr_engine.env.target ??
        getPlatformFromStats,
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

  /** Finds the compiler chunk named after a single Module Federation container. */
  getRemoteEntryChunk(
    stats: XStatsCompilation,
    FederationPluginOptions: typeof this.FederationPluginOptions
  ): XStatsChunk | undefined {
    if (!stats.chunks) return;

    return stats.chunks.find((chunk) =>
      chunk.names?.find((name) => name === FederationPluginOptions.name)
    );
  }

  /** Serializes referenced chunks for the dashboard without bundler-private `_groups`. */
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
      try {
        packageJson = require(this._options.packageJsonPath);
      } catch (error) {
        console.warn(
          `Unable to read package JSON at ${this._options.packageJsonPath}: ${String(error)}`
        );
      }
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
  attach_remote_bundle_name_to_metadata(
    configurations: readonly FederationPluginOptions[] = [this.FederationPluginOptions]
  ): Record<string, string> | undefined {
    // The legacy metadata field is singular. The complete multi-container representation
    // lives in buildStats.federation, so do not manufacture a bundle name here.
    if (configurations.length !== 1) {
      return;
    }
    const [configuration] = configurations;
    if (!configuration?.exposes) {
      return;
    }
    if (!configuration.bundle_name) {
      console.warn(ZeErrors.ERR_MF_CONFIG_MISSING_FILENAME);
      return;
    }

    return { remote_bundle_name: configuration.bundle_name };
  }

  async postDashboardData(): Promise<
    | {
        value: ZeUploadBuildStats;
      }
    | undefined
  > {
    // Publication is owned by the xpack upload agent. Keep this legacy extension point
    // safe for callers that still invoke it directly.
    return undefined;
  }
}
