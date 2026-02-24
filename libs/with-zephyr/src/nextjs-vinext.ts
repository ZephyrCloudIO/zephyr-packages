import fs from 'fs';
import path from 'path';

export interface PackageRequirement {
  name: string;
  isDev: boolean;
}

export interface NextJsVinextBootstrapResult {
  isNextJsApp: boolean;
  createdFiles: string[];
  updatedPackageJson: boolean;
  packageRequirements: PackageRequirement[];
}

interface PackageJsonShape {
  name?: string;
  type?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const VINEXT_VITE_CONFIG_TEMPLATE = `import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';
import { withZephyr } from 'vite-plugin-vinext-zephyr';

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
    withZephyr(),
  ],
});
`;

function sanitizeWorkerName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized.slice(0, 63) || 'vinext-app';
}

function getWranglerTemplate(workerName: string): string {
  return `{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "${workerName}",
  "compatibility_date": "2026-02-12",
  "compatibility_flags": ["nodejs_compat"],
  "main": "vinext/server/app-router-entry",
  "preview_urls": true,
  "assets": {
    "not_found_handling": "none",
  },
}
`;
}

function hasNextDependency(packageJson: PackageJsonShape): boolean {
  return Boolean(packageJson.dependencies?.next || packageJson.devDependencies?.next);
}

function getPackageNameForWorker(
  packageJson: PackageJsonShape,
  directory: string
): string {
  const packageName = packageJson.name || path.basename(path.resolve(directory));
  return sanitizeWorkerName(packageName.replace('/', '-'));
}

export function bootstrapNextJsVinext(
  directory: string,
  options: { dryRun?: boolean } = {}
): NextJsVinextBootstrapResult {
  const dryRun = options.dryRun ?? false;
  const packageJsonPath = path.join(directory, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return {
      isNextJsApp: false,
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
      isNextJsApp: false,
      createdFiles: [],
      updatedPackageJson: false,
      packageRequirements: [],
    };
  }

  if (!hasNextDependency(packageJson)) {
    return {
      isNextJsApp: false,
      createdFiles: [],
      updatedPackageJson: false,
      packageRequirements: [],
    };
  }

  const createdFiles: string[] = [];
  const viteConfigPath = path.join(directory, 'vite.config.ts');
  const wranglerConfigPath = path.join(directory, 'wrangler.jsonc');
  const workerName = getPackageNameForWorker(packageJson, directory);

  if (!fs.existsSync(viteConfigPath)) {
    createdFiles.push('vite.config.ts');
    if (!dryRun) {
      fs.writeFileSync(viteConfigPath, VINEXT_VITE_CONFIG_TEMPLATE);
    }
  }

  if (!fs.existsSync(wranglerConfigPath)) {
    createdFiles.push('wrangler.jsonc');
    if (!dryRun) {
      fs.writeFileSync(wranglerConfigPath, getWranglerTemplate(workerName));
    }
  }

  const desiredScripts: Record<string, string> = {
    dev: 'vinext dev',
    build: 'vinext build',
    start: 'vinext start',
  };

  const scripts = packageJson.scripts || {};
  let packageJsonChanged = false;
  for (const [scriptName, scriptValue] of Object.entries(desiredScripts)) {
    if (scripts[scriptName] !== scriptValue) {
      scripts[scriptName] = scriptValue;
      packageJsonChanged = true;
    }
  }

  if (packageJson.type !== 'module') {
    packageJson.type = 'module';
    packageJsonChanged = true;
  }

  if (packageJsonChanged && !dryRun) {
    packageJson.scripts = scripts;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  return {
    isNextJsApp: true,
    createdFiles,
    updatedPackageJson: packageJsonChanged,
    packageRequirements: [
      { name: 'vinext', isDev: false },
      { name: 'vite-plugin-vinext-zephyr', isDev: true },
      { name: '@cloudflare/vite-plugin', isDev: true },
      { name: 'vite', isDev: true },
      { name: 'wrangler', isDev: true },
    ],
  };
}
