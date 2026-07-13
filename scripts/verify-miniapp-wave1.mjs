import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const rootPath = fileURLToPath(root);
const workspacePath = join(rootPath, 'pnpm-workspace.yaml');
const workspace = readFileSync(workspacePath, 'utf8');

// Temporary workaround policy from module-federation/core#4894 at this audited
// head. The consumer workspaces own the emitted-manifest regression today.
const MF_PATCH_VERSION = '2.7.0';
const MF_PATCH_KEY = `@module-federation/manifest@${MF_PATCH_VERSION}`;
const MF_PATCH_FILE = `patches/@module-federation__manifest@${MF_PATCH_VERSION}.patch`;
const MF_UPSTREAM_HEAD = '28b4db7497097f46f4523b2911fd2f5b511514e9';
const MF_AFFECTED_CATALOG_PACKAGES = new Set([
  '@module-federation/enhanced',
  '@module-federation/rsbuild-plugin',
  '@module-federation/rspack',
  '@module-federation/runtime',
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function moduleFederationCatalogUsesExactVersions() {
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
    affectedEntries.every(([, version]) => version === MF_PATCH_VERSION)
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

const patchRegistered = new RegExp(
  `['"]?${escapeRegExp(MF_PATCH_KEY)}['"]?\\s*:\\s*${escapeRegExp(MF_PATCH_FILE)}`
).test(workspace);
const unusedPatchesFailClosed = /(?:^|\n)allowUnusedPatches:\s*false(?:\n|$)/.test(workspace);
const patchExists = existsSync(join(rootPath, MF_PATCH_FILE));

if (executableConfigs.length > 0) {
  const missing = [];
  if (!patchRegistered) missing.push(`register ${MF_PATCH_KEY}`);
  if (!patchExists) missing.push(`commit ${MF_PATCH_FILE}`);
  if (!unusedPatchesFailClosed) missing.push('set allowUnusedPatches: false');
  if (!moduleFederationCatalogUsesExactVersions()) {
    missing.push(`exact-pin the module-federation catalog to ${MF_PATCH_VERSION}`);
  }

  if (missing.length > 0) {
    throw new Error(
      [
        'Executable Rsbuild/Rspack ESM remote fixtures now make module-federation/core#4894 applicable:',
        ...executableConfigs.map((path) => `- ${path}`),
        `Required for upstream head ${MF_UPSTREAM_HEAD}:`,
        ...missing.map((item) => `- ${item}`),
      ].join('\n')
    );
  }
} else if (patchRegistered || patchExists) {
  throw new Error(
    `The ${MF_PATCH_KEY} workaround is registered without an executable Rsbuild/Rspack ESM remote fixture. ` +
      'Keep the generic package workspace unpatched; consumer workspaces own this workaround.'
  );
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
    `- PR #4894 patch: ${executableConfigs.length === 0 ? 'intentionally not applicable' : 'registered'}`,
    `- Zephyr publication dependencies: ${workspaceZephyrDependencies} workspace source, ${registryZephyrDependencies} registry`,
    `- External registry policy: exact ${ZEPHYR_CANARY}`,
  ].join('\n')
);
