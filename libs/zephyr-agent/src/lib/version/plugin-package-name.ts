import type { ZePackageJson } from '../build-context/ze-package-json.type';

type ZephyrEngineBuilderTypes =
  | 'webpack'
  | 'rspack'
  | 'repack'
  | 'metro'
  | 'vite'
  | 'rollup'
  | 'parcel'
  | 'astro'
  | 'unknown';

const FALLBACK_PLUGIN_PACKAGE_NAME = 'zephyr-packages';

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
  rollup: ['rollup-plugin-zephyr', 'zephyr-rolldown-plugin'],
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
  builder: ZephyrEngineBuilderTypes
): string {
  const declaredPackageNames = collectDeclaredPackageNames(packageJson);

  for (const candidate of BUILDER_PLUGIN_CANDIDATES[builder]) {
    if (declaredPackageNames.has(candidate)) {
      return candidate;
    }
  }

  for (const packageName of KNOWN_PLUGIN_PACKAGES) {
    if (declaredPackageNames.has(packageName)) {
      return packageName;
    }
  }

  return BUILDER_PLUGIN_CANDIDATES[builder][0] ?? FALLBACK_PLUGIN_PACKAGE_NAME;
}
