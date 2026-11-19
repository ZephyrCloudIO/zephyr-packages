import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { safe_json_parse } from 'zephyr-edge-contract';
import type { ZePackageJson } from '../build-context/ze-package-json.type';
import type { ZephyrEngineBuilderTypes } from '../../zephyr-engine/zephyr-engine.types';

const FALLBACK_PLUGIN_PACKAGE_NAME = 'zephyr-packages';
const requireFromHere = createRequire(__filename);

const BUILDER_PLUGIN_CANDIDATES: Record<ZephyrEngineBuilderTypes, string[]> = {
  webpack: ['zephyr-webpack-plugin', 'zephyr-modernjs-plugin'],
  rspack: [
    'zephyr-rspack-plugin',
    'zephyr-rsbuild-plugin',
    'zephyr-rspress-plugin',
    'zephyr-modernjs-plugin',
  ],
  repack: ['zephyr-repack-plugin'],
  metro: ['zephyr-metro-plugin'],
  vite: [
    'vite-plugin-zephyr',
    'vite-plugin-vinext-zephyr',
    'vite-plugin-tanstack-start-zephyr',
  ],
  nuxt: ['zephyr-nuxt-module'],
  rollup: ['rollup-plugin-zephyr'],
  rolldown: ['zephyr-rolldown-plugin'],
  parcel: ['parcel-reporter-zephyr'],
  astro: ['zephyr-astro-integration'],
  unknown: ['zephyr-cli'],
};

const KNOWN_PLUGIN_PACKAGES = [
  'zephyr-webpack-plugin',
  'zephyr-modernjs-plugin',
  'zephyr-rspack-plugin',
  'zephyr-rsbuild-plugin',
  'zephyr-rspress-plugin',
  'zephyr-repack-plugin',
  'zephyr-metro-plugin',
  'vite-plugin-zephyr',
  'vite-plugin-vinext-zephyr',
  'vite-plugin-tanstack-start-zephyr',
  'zephyr-nuxt-module',
  'rollup-plugin-zephyr',
  'zephyr-rolldown-plugin',
  'parcel-reporter-zephyr',
  'zephyr-astro-integration',
  'zephyr-cli',
] as const;

function collectDeclaredPackageNames(packageJson: ZePackageJson): Set<string> {
  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
  ]);
}

export function resolveZephyrPluginPackageName(
  packageJson: ZePackageJson,
  builder: string
): string {
  const declaredPackageNames = collectDeclaredPackageNames(packageJson);
  const builderCandidates =
    BUILDER_PLUGIN_CANDIDATES[builder as ZephyrEngineBuilderTypes] ?? [];

  for (const candidate of builderCandidates) {
    if (declaredPackageNames.has(candidate)) {
      return candidate;
    }
  }

  for (const packageName of KNOWN_PLUGIN_PACKAGES) {
    if (declaredPackageNames.has(packageName)) {
      return packageName;
    }
  }

  return builderCandidates[0] ?? FALLBACK_PLUGIN_PACKAGE_NAME;
}

/** The Zephyr plugin package building this project, as far as it can be determined. */
export interface ZephyrPluginIdentity {
  /** Package name, for example `zephyr-webpack-plugin`. */
  name?: string;
  /** Installed version of that package. */
  version?: string;
}

/** Reads the version of an installed package, resolved from `fromDir`. */
export function resolveInstalledPackageVersion(
  packageName: string,
  fromDir: string = process.cwd()
): string | undefined {
  try {
    const packageJsonPath = requireFromHere.resolve(`${packageName}/package.json`, {
      paths: [fromDir],
    });
    const parsed = safe_json_parse<{ version?: unknown }>(
      readFileSync(packageJsonPath, 'utf8')
    );
    return typeof parsed?.version === 'string' && parsed.version
      ? parsed.version
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Names the plugin package and its installed version. Unlike
 * {@linkcode resolveZephyrPluginPackageName}, it never reports a guess: the package must
 * be declared by the project or installed, otherwise the identity is empty.
 */
export function resolveZephyrPluginIdentity(
  packageJson: ZePackageJson,
  builder: string,
  projectDir: string = process.cwd()
): ZephyrPluginIdentity {
  try {
    const name = resolveZephyrPluginPackageName(packageJson, builder);
    if (name === FALLBACK_PLUGIN_PACKAGE_NAME) return {};
    const version = resolveInstalledPackageVersion(name, projectDir);
    if (version) return { name, version };
    return collectDeclaredPackageNames(packageJson).has(name) ? { name } : {};
  } catch {
    return {};
  }
}
