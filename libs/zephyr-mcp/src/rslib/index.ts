/**
 * Build a repo's `tools/*.ts` into a provider artifact for the Zephyr MCP: one
 * self-contained `dist/tools/index.js` for a Worker Loader isolate, plus `catalog.json`,
 * `mcp-provider.json` and the served skill files. Node only.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { RsbuildPlugin, RslibConfig, Rspack } from '@rslib/core';
import { checkCatalog } from '../checks/catalog';
import { finding, hasErrors, sortFindings, type Finding } from '../checks/finding';
import { checkRepo } from '../checks/repo';
import { runtimeModuleProblems } from '../checks/artifact';
import { findSecrets } from '../checks/secrets';
import { checkToolModule } from '../checks/tool-module';
import { buildCatalogManifest } from '../manifest/build';
import type { CatalogTool, McpProviderDescriptor } from '../manifest/catalog';
import {
  CATALOG_MANIFEST_FILE,
  DEFAULT_COMPATIBILITY_DATE,
  PROVIDER_DESCRIPTOR_FILE,
  RUNTIME_COMPATIBILITY_FLAGS,
  RUNTIME_ENTRY,
} from '../manifest/constants';
import { sha256Hex } from '../manifest/hash';
import { slug } from '../manifest/slug';
import { loadRepo } from '../repo/index';
import type { SkillsProvider } from '../types';
import { isSkillName, RESERVED_TOOL_NAMES, TOOL_NAME_PATTERN } from '../validate';
import { PROVIDER_SYMBOL } from '../worker/protocol';
import { GENERATED_TOOLS_SPECIFIER, TOOL_MODULE_SYMBOL } from './symbols';

export interface McpConfigOptions {
  /** Provider name. Defaults to `slug(package.json name)`. */
  name?: string;
  /** Provider version. Defaults to `package.json` version. */
  version?: string;
  /**
   * Worker compatibility date of the isolate, `YYYY-MM-DD`. Defaults to `2026-07-01`,
   * pinned per package release. The Zephyr MCP loads a provider only when the date is
   * within [`2025-11-17`, the MCP's own compatibility date] and otherwise skips all of
   * its tools, so the build fails on an earlier date and warns on one later than the
   * default.
   */
  compatibilityDate?: string;
}

const GENERATOR = 'zephyr-mcp/rslib';
const LOG_PREFIX = '[zephyr-mcp]';

const here = path.dirname(fileURLToPath(import.meta.url));

// package.json is two levels up from both dist/rslib and src/rslib.
const packageVersion = (
  JSON.parse(readFileSync(path.join(here, '../../package.json'), 'utf8')) as {
    version: string;
  }
).version;

/** Turns `import text from './file.txt?raw'` into a string import. */
const rawSourceRule = {
  resourceQuery: /(?:^|[?&])raw(?:$|&)/,
  type: 'asset/source',
} as const;

// The entry ships next to this file: entry.js in dist, entry.ts in src.
const entryFile = (() => {
  const built = path.join(here, 'entry.js');
  return existsSync(built) ? built : path.join(here, 'entry.ts');
})();

interface PackageJson {
  name?: string;
  version?: string;
}

const readPackageJson = async (root: string): Promise<PackageJson> => {
  try {
    return JSON.parse(
      await readFile(path.join(root, 'package.json'), 'utf8')
    ) as PackageJson;
  } catch {
    return {};
  }
};

const resolveIdentity = async (root: string, options: McpConfigOptions) => {
  const pkg = await readPackageJson(root);
  const name = options.name ?? (pkg.name === undefined ? undefined : slug(pkg.name));
  if (!name || !isSkillName(name)) {
    throw new Error(
      `${LOG_PREFIX} defineMcpConfig needs a provider name of 1-64 lowercase letters, digits and hyphens; got ${JSON.stringify(name)}. Set package.json "name" or pass defineMcpConfig({ name: 'billing-tools' })`
    );
  }
  return { name, version: options.version ?? pkg.version };
};

const toolName = (file: string) => file.slice('tools/'.length, -'.ts'.length);

// The generated module: one namespace import per tool file.
const generatedModule = (
  root: string,
  identity: { name: string; version?: string },
  tools: readonly string[]
) =>
  [
    ...tools.map(
      (file, index) =>
        `import * as t${index} from ${JSON.stringify(path.join(root, file))};`
    ),
    `export const name = ${JSON.stringify(identity.name)};`,
    `export const version = ${JSON.stringify(identity.version)};`,
    `export const modules = [${tools
      .map(
        (file, index) =>
          `[${JSON.stringify(toolName(file))}, ${JSON.stringify(file)}, t${index}]`
      )
      .join(', ')}];`,
  ].join('\n');

const listFiles = async (dir: string, prefix = ''): Promise<string[]> => {
  const entries = await readdir(path.join(dir, prefix), {
    withFileTypes: true,
  }).catch(() => []);
  const nested = await Promise.all(
    entries.map((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(dir, relative) : Promise.resolve([relative]);
    })
  );
  return nested.flat().sort();
};

// Files the preset writes itself. Rsbuild cleans dist/ only before the
// first build, so in watch mode they are still there from the last run;
// the bundler never emits them (one entry, no chunks, inlined assets).
const isWrittenByPreset = (file: string) =>
  file === CATALOG_MANIFEST_FILE ||
  file === PROVIDER_DESCRIPTOR_FILE ||
  file.startsWith('skills/');

// What the bundler emitted into dist/.
const emittedFiles = async (dist: string): Promise<string[]> =>
  (await listFiles(dist)).filter((file) => !isWrittenByPreset(file));

const toJsonText = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const formatFinding = (item: Finding) =>
  `${item.code} ${item.severity} ${item.path}: ${item.message}`;

// Loads the bundle by content: a changed bundle is a new URL, so Node's ESM
// cache never hands back a stale module in watch mode.
const loadProvider = async (
  bundle: string,
  bytes: Uint8Array
): Promise<SkillsProvider> => {
  const url = `${pathToFileURL(bundle).href}?v=${await sha256Hex(bytes)}`;
  let module: { default?: unknown };
  try {
    module = (await import(url)) as { default?: unknown };
  } catch (error) {
    throw new Error(
      `${LOG_PREFIX} ${RUNTIME_ENTRY} failed to load, so its tools cannot be checked: ${(error as Error).message}. A tool module probably throws while it is evaluated.`,
      { cause: error }
    );
  }
  const provider =
    module.default && typeof module.default === 'object'
      ? (module.default as Record<symbol, unknown>)[PROVIDER_SYMBOL]
      : undefined;
  if (!provider || typeof provider !== 'object') {
    throw new Error(
      `${LOG_PREFIX} ${RUNTIME_ENTRY} does not default-export a provider worker`
    );
  }
  return provider as SkillsProvider;
};

const GENERATED_DIR = '.zephyr-mcp';
const GENERATED_GLOB = `**/${GENERATED_DIR}/**`;

type ConfigWatchIgnored = NonNullable<Rspack.Configuration['watchOptions']>['ignored'];
// Rspack 1.x after @rslib/core 1.0.0 also accepts a function.
type WatchIgnored = ConfigWatchIgnored | ((entry: string) => boolean);

// Adds the generated module's folder to whatever the config already ignores.
const ignoreGenerated = (ignored: WatchIgnored): WatchIgnored => {
  if (ignored === undefined) return [GENERATED_GLOB];
  if (typeof ignored === 'string') return [ignored, GENERATED_GLOB];
  if (Array.isArray(ignored)) return [...ignored, GENERATED_GLOB];
  if (typeof ignored === 'function') {
    return (entry: string) =>
      ignored(entry) || entry.split(/[\\/]/).includes(GENERATED_DIR);
  }
  return new RegExp(String.raw`${ignored.source}|[\\/]\.zephyr-mcp[\\/]`, ignored.flags);
};

const findingKey = (item: Finding) =>
  `${item.rule}\u0000${item.skill ?? ''}\u0000${item.tool ?? ''}`;

// The catalog checks repeat the skill rules checkRepo already reported at
// the source, and report everything at catalog.json, a file a failed build
// never writes. Keep what only the catalog finds, at the source path.
const sourceFindings = (
  catalogFindings: readonly Finding[],
  repoFindings: readonly Finding[]
): Finding[] => {
  const reported = new Set(repoFindings.map(findingKey));
  return catalogFindings.flatMap((item) => {
    if (reported.has(findingKey(item))) return [];
    const source = item.tool
      ? `tools/${item.tool}.ts`
      : item.skill
        ? `skills/${item.skill}/SKILL.md`
        : undefined;
    if (!source) return [item];
    // Drop the catalog JSON path ("tools/0/annotations: ") from the message.
    const message = item.message.replace(/^[^\s:]+: /, '');
    return [{ ...item, path: source, message }];
  });
};

const isCatalogable = (name: string) =>
  TOOL_NAME_PATTERN.test(name) && !RESERVED_TOOL_NAMES.includes(name);

/**
 * The Rsbuild plugin behind {@link defineMcpConfig}: generates the tool list, then after
 * the build checks the bundle, reads the tools' schemas from it, and writes
 * `catalog.json`, `mcp-provider.json` and `skills/`. Fails the build on any error
 * finding.
 */
export function pluginMcpProvider(options: McpConfigOptions = {}): RsbuildPlugin {
  return {
    name: 'zephyr-mcp:provider',
    setup(api) {
      const root = api.context.rootPath;
      if (
        options.compatibilityDate !== undefined &&
        options.compatibilityDate > DEFAULT_COMPATIBILITY_DATE
      ) {
        console.warn(
          `${LOG_PREFIX} compatibilityDate ${options.compatibilityDate} is later than ${DEFAULT_COMPATIBILITY_DATE}; the Zephyr MCP skips every tool of a provider whose date is later than its own compatibility date`
        );
      }

      api.modifyRspackConfig(async (config, { rspack }) => {
        const identity = await resolveIdentity(root, options);
        const { tools } = await loadRepo(root);
        const generated = path.join(root, GENERATED_DIR, 'tools.js');
        config.plugins.push(
          new rspack.experiments.VirtualModulesPlugin({
            [generated]: generatedModule(root, identity, tools),
          })
        );
        config.resolve ??= {};
        config.resolve.alias = {
          ...(config.resolve.alias as Record<string, string> | undefined),
          [`${GENERATED_TOOLS_SPECIFIER}$`]: generated,
        };
        // The generated module is not on disk; in watch mode the watcher
        // would see it as removed and rebuild without it.
        config.watchOptions = {
          ...config.watchOptions,
          ignored: ignoreGenerated(config.watchOptions?.ignored) as ConfigWatchIgnored,
        };
      });

      api.onAfterBuild(async ({ stats, environments }) => {
        if (stats?.hasErrors()) return;
        const dist = Object.values(environments)[0]?.distPath;
        if (!dist) return;
        const identity = await resolveIdentity(root, options);
        const findings: Finding[] = [];

        const emitted = await emittedFiles(dist);
        const extra = emitted.filter((file) => file !== RUNTIME_ENTRY);
        if (extra.length > 0 || !emitted.includes(RUNTIME_ENTRY)) {
          throw new Error(
            `${LOG_PREFIX} the build must emit ${RUNTIME_ENTRY} and nothing else; it emitted ${emitted.join(', ') || 'nothing'}. Inline assets and avoid code splitting in tools.`
          );
        }
        const bundlePath = path.join(dist, RUNTIME_ENTRY);
        const bundle = new Uint8Array(await readFile(bundlePath));
        const source = new TextDecoder().decode(bundle);
        const problems = runtimeModuleProblems(source);
        if (problems.length > 0) {
          throw new Error(
            `${LOG_PREFIX} ${RUNTIME_ENTRY} must be one self-contained module, but it ${problems.join(', ')}. Tools cannot use node:* or cloudflare:* modules.`
          );
        }
        // The bundle inlines code from outside tools/ (src/, dependencies,
        // ?raw imports), so it is scanned as uploaded, not just the sources.
        for (const { line, masked } of findSecrets(source)) {
          findings.push(
            finding(
              'tool-secret',
              RUNTIME_ENTRY,
              `line ${line} of the bundle looks like a secret (${masked}); find where the tools import it from, read it from the environment instead and rotate it`
            )
          );
        }

        const provider = await loadProvider(bundlePath, bundle);
        const tools: CatalogTool[] = [];
        for (const tool of provider.tools) {
          const source = (tool as unknown as Record<symbol, unknown>)[
            TOOL_MODULE_SYMBOL
          ] as { file: string; exported: unknown } | undefined;
          const result = checkToolModule({
            file: source?.file ?? `tools/${tool.name}.ts`,
            name: tool.name,
            exported: source ? source.exported : tool,
          });
          findings.push(...result.findings);
          // Invalid and reserved names are reported by checkRepo.
          if (result.tool && isCatalogable(tool.name)) tools.push(result.tool);
        }

        const repo = await loadRepo(root);
        const repoFindings = await checkRepo(root, { building: true });
        findings.push(...repoFindings);

        const catalog = await buildCatalogManifest({
          provider: identity,
          skills: repo.skills,
          tools,
          ...(tools.length > 0 && {
            runtime: {
              module: bundle,
              compatibilityDate: options.compatibilityDate ?? DEFAULT_COMPATIBILITY_DATE,
              compatibilityFlags: RUNTIME_COMPATIBILITY_FLAGS,
            },
          }),
        }).catch((error: unknown) => {
          // Skills that cannot be cataloged are already findings.
          if (hasErrors(findings)) return undefined;
          throw error;
        });
        const descriptor: McpProviderDescriptor = {
          manifestVersion: 1,
          name: identity.name,
          ...(identity.version !== undefined && { version: identity.version }),
          catalog: CATALOG_MANIFEST_FILE,
          generator: { name: GENERATOR, version: packageVersion },
        };
        // Check the exact text that is written, so the 512 KiB limit applies
        // to the file ze-cli uploads.
        const catalogText = catalog && toJsonText(catalog);
        if (catalogText) {
          findings.push(
            ...sourceFindings(checkCatalog(catalogText, descriptor), repoFindings)
          );
        }

        for (const item of sortFindings(findings)) {
          const log = item.severity === 'error' ? console.error : console.warn;
          log(`${LOG_PREFIX} ${formatFinding(item)}`);
        }
        if (!catalogText || hasErrors(findings)) {
          throw new Error(
            `${LOG_PREFIX} the provider has ${findings.filter((item) => item.severity === 'error').length} error(s); fix them and build again`
          );
        }

        if (tools.length === 0) {
          await rm(path.join(dist, 'tools'), { recursive: true, force: true });
        }
        // A rebuild in watch mode must not keep skill files from the last run.
        await rm(path.join(dist, 'skills'), { recursive: true, force: true });
        for (const skill of repo.skills) {
          for (const file of skill.files) {
            const target = path.join(dist, skill.path, file.path);
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, file.bytes);
          }
        }
        await writeFile(path.join(dist, CATALOG_MANIFEST_FILE), catalogText);
        await writeFile(
          path.join(dist, PROVIDER_DESCRIPTOR_FILE),
          toJsonText(descriptor)
        );
      });
    },
  };
}

/**
 * The Rslib config for a repo with `tools/<name>.ts` files: builds them into one ES
 * module for a Worker Loader isolate and writes the provider artifact to `dist/` for
 * `ze-cli deploy dist`.
 *
 * @example
 *   ```ts
 *   // rslib.config.ts
 *   import { defineMcpConfig } from 'zephyr-mcp/rslib';
 *
 *   export default defineMcpConfig();
 *   ```;
 */
export function defineMcpConfig(options: McpConfigOptions = {}): RslibConfig {
  return {
    lib: [
      {
        format: 'esm',
        bundle: true,
        syntax: 'es2022',
        dts: false,
        autoExtension: false,
        source: { entry: { index: entryFile } },
        output: {
          // Rslib rejects 'web-worker' as a target; the rspack target below
          // makes the bundle a worker module.
          target: 'web',
          autoExternal: false,
          distPath: { root: 'dist' },
          filename: { js: RUNTIME_ENTRY },
          legalComments: 'inline',
          sourceMap: false,
        },
        tools: {
          rspack: (config: Rspack.Configuration) => {
            config.target = ['webworker', 'es2022'];
            config.output = { ...config.output, asyncChunks: false };
            config.optimization = {
              ...config.optimization,
              splitChunks: false,
            };
            config.module ??= {};
            config.module.parser ??= {};
            config.module.parser.javascript = {
              ...config.module.parser.javascript,
              importDynamic: true,
              dynamicImportMode: 'eager',
            };
            config.module.rules = [...(config.module.rules ?? []), rawSourceRule];
            config.resolve ??= {};
            config.resolve.conditionNames = [
              'workerd',
              'worker',
              ...(config.resolve.conditionNames ?? [
                'browser',
                'import',
                'module',
                'default',
              ]),
            ];
          },
        },
      },
    ],
    plugins: [pluginMcpProvider(options)],
  };
}
