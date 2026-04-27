import fs from 'fs';
import path from 'path';
import type { PackageRequirement } from './nextjs-vinext.js';

export interface SlidevViteBootstrapResult {
  isSlidevApp: boolean;
  createdFiles: string[];
  updatedPackageJson: boolean;
  packageRequirements: PackageRequirement[];
}

interface PackageJsonShape {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const SLIDEV_VITE_CONFIG_TEMPLATE = `import { withZephyr } from 'vite-plugin-zephyr';

export default {
  plugins: [withZephyr()],
};
`;

function hasSlidevDependency(packageJson: PackageJsonShape): boolean {
  return Boolean(
    packageJson.dependencies?.['@slidev/cli'] ||
    packageJson.devDependencies?.['@slidev/cli']
  );
}

function hasAnyViteConfig(directory: string): boolean {
  return [
    'vite.config.js',
    'vite.config.ts',
    'vite.config.mjs',
    'vite.config.mts',
  ].some((fileName) => fs.existsSync(path.join(directory, fileName)));
}

export function bootstrapSlidevVite(
  directory: string,
  options: { dryRun?: boolean } = {}
): SlidevViteBootstrapResult {
  const dryRun = options.dryRun ?? false;
  const packageJsonPath = path.join(directory, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return {
      isSlidevApp: false,
      createdFiles: [],
      updatedPackageJson: false,
      packageRequirements: [],
    };
  }

  let packageJson: PackageJsonShape;
  try {
    packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8')
    ) as PackageJsonShape;
  } catch {
    return {
      isSlidevApp: false,
      createdFiles: [],
      updatedPackageJson: false,
      packageRequirements: [],
    };
  }

  if (!hasSlidevDependency(packageJson)) {
    return {
      isSlidevApp: false,
      createdFiles: [],
      updatedPackageJson: false,
      packageRequirements: [],
    };
  }

  const createdFiles: string[] = [];

  if (!hasAnyViteConfig(directory)) {
    createdFiles.push('vite.config.ts');
    if (!dryRun) {
      fs.writeFileSync(
        path.join(directory, 'vite.config.ts'),
        SLIDEV_VITE_CONFIG_TEMPLATE
      );
    }
  }

  let packageJsonChanged = false;
  if (!packageJson.name) {
    packageJson.name = path.basename(path.resolve(directory));
    packageJsonChanged = true;
  }
  if (!packageJson.version) {
    packageJson.version = '1.0.0';
    packageJsonChanged = true;
  }

  if (packageJsonChanged && !dryRun) {
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n'
    );
  }

  return {
    isSlidevApp: true,
    createdFiles,
    updatedPackageJson: packageJsonChanged,
    packageRequirements: [{ name: 'vite-plugin-zephyr', isDev: true }],
  };
}
