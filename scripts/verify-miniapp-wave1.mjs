import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const rootPath = fileURLToPath(root);
const workspacePath = join(rootPath, 'pnpm-workspace.yaml');
const workspace = readFileSync(workspacePath, 'utf8');

// The upstream stable release contains module-federation/core#4894. Consumer
// workspaces own the emitted-manifest regression and must not restore the
// temporary local manifest patch.
const MF_STABLE_VERSION = '2.8.0';
const MF_AFFECTED_CATALOG_PACKAGES = new Set([
  '@module-federation/enhanced',
  '@module-federation/rsbuild-plugin',
  '@module-federation/rspack',
  '@module-federation/runtime',
]);
const MF_RELEASE_AGE_EXCLUSIONS = new Map([
  ['bridge-react-webpack-plugin', MF_STABLE_VERSION],
  ['cli', MF_STABLE_VERSION],
  ['dts-plugin', MF_STABLE_VERSION],
  ['enhanced', MF_STABLE_VERSION],
  ['error-codes', MF_STABLE_VERSION],
  ['inject-external-runtime-core-plugin', MF_STABLE_VERSION],
  ['managers', MF_STABLE_VERSION],
  ['manifest', MF_STABLE_VERSION],
  ['metro', MF_STABLE_VERSION],
  ['node', '2.7.47'],
  ['rsbuild-plugin', MF_STABLE_VERSION],
  ['rspack', MF_STABLE_VERSION],
  ['runtime-core', MF_STABLE_VERSION],
  ['runtime-tools', MF_STABLE_VERSION],
  ['runtime', MF_STABLE_VERSION],
  ['sdk', MF_STABLE_VERSION],
  ['third-party-dts-extractor', MF_STABLE_VERSION],
  ['webpack-bundler-runtime', MF_STABLE_VERSION],
]);
const ZEPHYR_CANARY = '0.0.0-canary.67';

const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

function walk(directory, visit) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'lib') {
      continue;
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path, visit);
    } else {
      visit(path);
    }
  }
}

function isExecutableFederationConfig(path) {
  return /^(?:rsbuild|rspack|module-federation)\.config\.[cm]?[jt]s$/.test(basename(path));
}

function isEsmRemoteConfig(path) {
  const source = readFileSync(path, 'utf8');
  const usesFederation =
    basename(path).startsWith('module-federation.config.') ||
    /(?:ModuleFederation|pluginModuleFederation|\bexposes\s*:)/.test(source);
  const declaresModuleLibrary = /\blibrary\s*:\s*\{[\s\S]{0,500}?\btype\s*:\s*['"]module['"]/.test(
    source
  );
  const emitsMjsRemote = /\bfilename\s*:\s*['"][^'"]*\.mjs['"]/.test(source);

  return usesFederation && (declaresModuleLibrary || emitsMjsRemote);
}

function moduleFederationCatalogUsesExactStableRelease() {
  const lines = workspace.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => /^  module-federation:\s*$/.test(line));
  if (sectionStart === -1) return false;

  const entries = new Map();
  for (const line of lines.slice(sectionStart + 1)) {
    if (/^  \S/.test(line)) break;
    const match = line.match(/^    ['"]?(@module-federation\/[^'"]+)['"]?:\s*(\S+)\s*$/);
    if (match) entries.set(match[1], match[2].replace(/^['"]|['"]$/g, ''));
  }

  const affectedEntries = [...entries].filter(([name]) => MF_AFFECTED_CATALOG_PACKAGES.has(name));
  return (
    affectedEntries.length > 0 &&
    affectedEntries.every(([, version]) => version === MF_STABLE_VERSION)
  );
}

const executableConfigs = [];
for (const directory of ['examples', 'e2e']) {
  walk(join(rootPath, directory), (path) => {
    if (isExecutableFederationConfig(path) && isEsmRemoteConfig(path)) {
      executableConfigs.push(relative(rootPath, path));
    }
  });
}

const manifestPatchRegistered = /@module-federation\/manifest@[^'"\s:]+['"]?\s*:\s*patches\//.test(
  workspace
);
const patchesPath = join(rootPath, 'patches');
const manifestPatchFiles = existsSync(patchesPath)
  ? readdirSync(patchesPath)
      .filter((name) => name.startsWith('@module-federation__manifest@') && name.endsWith('.patch'))
      .map((name) => relative(rootPath, join(patchesPath, name)))
  : [];
const missingReleaseAgeExclusions = [...MF_RELEASE_AGE_EXCLUSIONS].filter(
  ([name, version]) => !workspace.includes(`'@module-federation/${name}@${version}'`)
);

if (missingReleaseAgeExclusions.length > 0) {
  throw new Error(
    [
      'Module Federation stable-release maturity exclusions are incomplete:',
      ...missingReleaseAgeExclusions.map(
        ([name, version]) => `- @module-federation/${name}@${version}`
      ),
    ].join('\n')
  );
}

if (manifestPatchRegistered || manifestPatchFiles.length > 0) {
  throw new Error(
    [
      `Module Federation ${MF_STABLE_VERSION} contains the ESM manifest fix; remove the obsolete local manifest patch.`,
      ...manifestPatchFiles.map((path) => `- ${path}`),
    ].join('\n')
  );
}

if (executableConfigs.length > 0) {
  if (!moduleFederationCatalogUsesExactStableRelease()) {
    throw new Error(
      [
        'Executable Rsbuild/Rspack ESM remote fixtures require the upstream stable Module Federation release:',
        ...executableConfigs.map((path) => `- ${path}`),
        `- exact-pin the affected module-federation catalog packages to ${MF_STABLE_VERSION}`,
      ].join('\n')
    );
  }
}

const zephyrDependencies = [];
const invalidZephyrRegistryPins = [];
for (const directory of ['libs', 'examples', 'e2e']) {
  walk(join(rootPath, directory), (path) => {
    if (basename(path) !== 'package.json') return;

    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    for (const section of dependencySections) {
      for (const [name, version] of Object.entries(manifest[section] ?? {})) {
        if (!/^(?:@zephyrcloudio\/)?zephyr-/.test(name)) continue;

        const dependency = {
          manifest: relative(rootPath, path),
          name,
          section,
          version,
        };
        zephyrDependencies.push(dependency);

        if (
          typeof version !== 'string' ||
          (!version.startsWith('workspace:') && version !== ZEPHYR_CANARY)
        ) {
          invalidZephyrRegistryPins.push(dependency);
        }
      }
    }
  });
}

if (invalidZephyrRegistryPins.length > 0) {
  throw new Error(
    [
      `Zephyr miniapp publication dependencies must use exact ${ZEPHYR_CANARY}:`,
      ...invalidZephyrRegistryPins.map(
        ({ manifest, section, name, version }) =>
          `- ${manifest} ${section}.${name}=${JSON.stringify(version)}`
      ),
    ].join('\n')
  );
}

const workspaceZephyrDependencies = zephyrDependencies.filter(({ version }) =>
  String(version).startsWith('workspace:')
).length;
const registryZephyrDependencies = zephyrDependencies.length - workspaceZephyrDependencies;

console.log(
  [
    'Miniapp Wave 1 dependency policy verified.',
    `- Executable Rsbuild/Rspack ESM remote fixtures: ${executableConfigs.length}`,
    `- Module Federation ESM manifest fix: ${executableConfigs.length === 0 ? `consumer-owned (${MF_STABLE_VERSION})` : `exact ${MF_STABLE_VERSION}`}`,
    `- Module Federation maturity exclusions: ${MF_RELEASE_AGE_EXCLUSIONS.size}`,
    '- Local Module Federation manifest patch: absent',
    `- Zephyr publication dependencies: ${workspaceZephyrDependencies} workspace source, ${registryZephyrDependencies} registry`,
    `- External registry policy: exact ${ZEPHYR_CANARY}`,
  ].join('\n')
);
