#!/usr/bin/env node

import chalk from 'chalk';
import { program } from 'commander';
import fs from 'fs';
import { glob } from 'glob';
import path from 'path';

import {
  webpackConfig,
  rspackConfig,
  viteConfig,
  rollupConfig,
  rolldownConfig,
  rsbuildConfig,
  rslibConfig,
  parcelConfig,
  astroConfig,
  modernjsConfig,
  nuxtConfig,
  rspressConfig,
  metroConfig,
  repackConfig,
} from './bundlers/index.js';
import type { BundlerConfigs } from './types.js';
import {
  addToPackageJson,
  detectPackageManager,
  getLatestVersion,
  installDependencies,
  installPackages as installPackagesDirect,
  isPackageInstalled,
} from './package-manager.js';
import { bootstrapNextJsVinext, type PackageRequirement } from './nextjs-vinext.js';
import { applyBundlerOperations, hasZephyrCall } from './operations.js';
import type { BundlerConfig, CodemodOptions, ConfigFile } from './types.js';

// Local registry built from individual imports
const BUNDLER_CONFIGS: BundlerConfigs = {
  webpack: webpackConfig,
  rspack: rspackConfig,
  vite: viteConfig,
  rollup: rollupConfig,
  rolldown: rolldownConfig,
  rsbuild: rsbuildConfig,
  rslib: rslibConfig,
  parcel: parcelConfig,
  astro: astroConfig,
  modernjs: modernjsConfig,
  nuxt: nuxtConfig,
  rspress: rspressConfig,
  metro: metroConfig,
  repack: repackConfig,
};

/** Normalize file path separators to forward slashes for consistent output */
function normalizePathForOutput(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/** Find all bundler configuration files in the given directory */
function findConfigFiles(directory: string): ConfigFile[] {
  const configFiles: ConfigFile[] = [];

  for (const [bundlerName, config] of Object.entries(BUNDLER_CONFIGS)) {
    for (const fileName of config.files) {
      // Use forward slashes for glob pattern, even on Windows
      const pattern = `${directory}/**/${fileName}`.replace(/\\/g, '/');
      const matches = glob.sync(pattern, { ignore: ['**/node_modules/**'] });

      for (const filePath of matches) {
        configFiles.push({
          filePath,
          bundlerName,
          config,
        });
      }
    }
  }

  return configFiles;
}

/** Check if a rspack config file is actually a repack configuration */
function isRepackConfig(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    const repackIndicators = [
      /@react-native-community\/cli-platform-android/,
      /@react-native-community\/cli-platform-ios/,
      /react-native/,
      /\.bundle/,
      /@callstack\/repack/,
      /RepackPlugin/,
      /getResolverOptions/,
      /getContext/,
      /ReactNativeExperiments/,
    ];

    return repackIndicators.some((indicator) => indicator.test(content));
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Check if a configuration file already has Zephyr integration */
function checkHasZephyr(filePath: string, config: BundlerConfig): boolean {
  try {
    if (config.plugin === 'parcel-reporter-zephyr') {
      const content = fs.readFileSync(filePath, 'utf8');
      const parcelConfig = JSON.parse(content) as { reporters?: string[] };
      return (
        Array.isArray(parcelConfig.reporters) &&
        parcelConfig.reporters.includes(config.plugin)
      );
    }

    const result = hasZephyrCall(filePath, config);
    return result.status === 'changed';
  } catch (error) {
    console.warn(
      chalk.yellow(
        `Warning: Could not parse ${normalizePathForOutput(filePath)}: ${(error as Error).message}`
      )
    );
    return false;
  }
}

function ensureZephyrImportOrRequire(
  filePath: string,
  config: BundlerConfig,
  options: { dryRun?: boolean } = {}
): { status: 'changed' | 'no-change' | 'error'; error?: string } {
  const { dryRun = false } = options;

  if (!config.importName) {
    return { status: 'no-change' };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const plugin = config.plugin;
    const importName = config.importName;

    const hasPluginImport = new RegExp(
      `from\\s+['"]${escapeRegExp(plugin)}['"]|require\\(\\s*['"]${escapeRegExp(plugin)}['"]\\s*\\)`
    ).test(content);

    if (hasPluginImport) {
      return { status: 'no-change' };
    }

    const hasESMSyntax = content.includes('import ') || content.includes('export ');
    const isCommonJS = filePath.endsWith('.js') && !hasESMSyntax;

    let nextContent = content;

    if (isCommonJS) {
      const requireLine = `const { ${importName} } = require("${plugin}");\n`;
      nextContent = `${requireLine}${content}`;
    } else {
      const importLine = `import { ${importName} } from "${plugin}";`;
      const firstImportMatch = content.match(/^\s*import[^\n]*\n?/m);

      if (firstImportMatch && firstImportMatch.index !== undefined) {
        const insertionPoint = firstImportMatch.index + firstImportMatch[0].length;
        nextContent = `${content.slice(0, insertionPoint)}${importLine}\n${content.slice(insertionPoint)}`;
      } else {
        nextContent = `${importLine}\n${content}`;
      }
    }

    if (nextContent !== content && !dryRun) {
      fs.writeFileSync(filePath, nextContent);
    }

    return nextContent === content ? { status: 'no-change' } : { status: 'changed' };
  } catch (error) {
    return {
      status: 'error',
      error: (error as Error).message,
    };
  }
}

/** Transform a configuration file to add Zephyr integration */
function transformConfigFile(
  filePath: string,
  bundlerName: string,
  config: BundlerConfig,
  options: { dryRun?: boolean } = {}
): boolean {
  const { dryRun = false } = options;

  try {
    console.log(
      chalk.blue(`Processing ${bundlerName} config: ${normalizePathForOutput(filePath)}`)
    );

    const operationResult = applyBundlerOperations({
      filePath,
      config,
      dryRun,
    });

    if (operationResult.status === 'error') {
      console.error(
        chalk.red(
          `Error transforming ${normalizePathForOutput(filePath)}: ${
            operationResult.error || 'Operation failed'
          }`
        )
      );
      return false;
    }

    if (operationResult.status === 'no-match') {
      console.error(
        chalk.red(
          `Error transforming ${normalizePathForOutput(filePath)}: No applicable transformation operation`
        )
      );
      return false;
    }

    const importResult = ensureZephyrImportOrRequire(filePath, config, { dryRun });
    if (importResult.status === 'error') {
      console.error(
        chalk.red(
          `Error transforming ${normalizePathForOutput(filePath)}: ${
            importResult.error || 'Failed to update imports'
          }`
        )
      );
      return false;
    }

    console.log(
      chalk.green(`✓ Added Zephyr integration to ${normalizePathForOutput(filePath)}`)
    );
    return true;
  } catch (error) {
    console.error(
      chalk.red(
        `Error transforming ${normalizePathForOutput(filePath)}: ${(error as Error).message}`
      )
    );
    return false;
  }
}

/** Main codemod function */
function runCodemod(directory: string, options: CodemodOptions = {}): void {
  const { dryRun = false, bundlers = null, installPackages = true } = options;

  console.log(chalk.bold(`🚀 Zephyr Codemod - Adding Zephyr integration to configs`));
  console.log(chalk.gray(`Directory: ${path.resolve(directory)}`));

  if (dryRun) {
    console.log(chalk.yellow(`🔍 Dry run mode - no files will be modified\n`));
  }

  const nextJsBootstrap = bootstrapNextJsVinext(directory, { dryRun });
  if (nextJsBootstrap.isNextJsApp) {
    if (nextJsBootstrap.createdFiles.length > 0) {
      for (const createdFile of nextJsBootstrap.createdFiles) {
        const message = dryRun
          ? `Would create ${createdFile} for Vinext`
          : `Created ${createdFile} for Vinext`;
        console.log(chalk.green(`✓ ${message}`));
      }
    }
    if (nextJsBootstrap.updatedPackageJson) {
      const message = dryRun
        ? 'Would update package.json scripts to vinext commands'
        : 'Updated package.json scripts to vinext commands';
      console.log(chalk.green(`✓ ${message}`));
    }
    if (nextJsBootstrap.createdFiles.length > 0 || nextJsBootstrap.updatedPackageJson) {
      console.log();
    }
  }

  const configFiles = findConfigFiles(directory);

  if (configFiles.length === 0 && !nextJsBootstrap.isNextJsApp) {
    console.log(chalk.yellow('No bundler configuration files found.'));
    return;
  }

  // Collect unique plugins that need to be installed
  const requiredPackages = new Map<string, PackageRequirement>();
  const packagesToProcess: ConfigFile[] = [];
  const filteredConfigFiles: ConfigFile[] = [];

  for (const packageRequirement of nextJsBootstrap.packageRequirements) {
    requiredPackages.set(packageRequirement.name, packageRequirement);
  }

  for (const { filePath, bundlerName, config } of configFiles) {
    // Filter by specific bundlers if requested
    if (bundlers && !bundlers.includes(bundlerName)) {
      continue;
    }

    // Skip repack processing for files that aren't actually repack configs
    if (bundlerName === 'repack' && !isRepackConfig(filePath)) {
      continue;
    }

    // Skip rspack processing for files that are actually repack configs
    if (bundlerName === 'rspack' && isRepackConfig(filePath)) {
      continue;
    }

    filteredConfigFiles.push({ filePath, bundlerName, config });

    // Check if already has Zephyr integration
    if (checkHasZephyr(filePath, config)) {
      console.log(
        chalk.gray(
          `⏭️  Skipping ${normalizePathForOutput(filePath)} (already has Zephyr integration)`
        )
      );
      continue;
    }

    requiredPackages.set(config.plugin, { name: config.plugin, isDev: true });
    packagesToProcess.push({ filePath, bundlerName, config });
  }

  console.log(chalk.blue(`Found ${filteredConfigFiles.length} configuration file(s):\n`));
  const missingPackages: PackageRequirement[] = [];
  if (installPackages) {
    for (const packageRequirement of requiredPackages.values()) {
      if (!isPackageInstalled(packageRequirement.name, directory)) {
        missingPackages.push(packageRequirement);
      }
    }
  }

  if (installPackages && missingPackages.length > 0 && dryRun) {
    console.log(chalk.blue(`\n📦 Packages that would be installed:\n`));
    for (const packageRequirement of missingPackages) {
      console.log(chalk.yellow(`  - ${packageRequirement.name}`));
    }
    console.log();
  }

  // Process configuration files
  let processed = 0;
  let errors = 0;

  for (const { filePath, bundlerName, config } of packagesToProcess) {
    const success = transformConfigFile(filePath, bundlerName, config, {
      dryRun,
    });
    if (success) {
      processed++;
    } else {
      errors++;
    }
  }

  if (installPackages && missingPackages.length > 0 && !dryRun) {
    console.log(chalk.blue(`\n📦 Checking package dependencies...\n`));

    const packageManager = detectPackageManager(directory);
    console.log(chalk.gray(`Detected package manager: ${packageManager}`));

    const packageJsonPath = path.join(directory, 'package.json');
    const stagedPackages: PackageRequirement[] = [];
    const fallbackPackages: PackageRequirement[] = [];

    if (fs.existsSync(packageJsonPath)) {
      for (const packageRequirement of missingPackages) {
        const latestVersion = getLatestVersion(packageRequirement.name);
        const added = addToPackageJson(
          directory,
          packageRequirement.name,
          latestVersion,
          packageRequirement.isDev
        );
        if (added) {
          stagedPackages.push(packageRequirement);
          console.log(chalk.green(`✓ Added ${packageRequirement.name} to package.json`));
        } else {
          fallbackPackages.push(packageRequirement);
          console.log(
            chalk.red(
              `✗ Failed to stage ${packageRequirement.name} in package.json, falling back`
            )
          );
        }
      }
    } else {
      fallbackPackages.push(...missingPackages);
      console.log(
        chalk.yellow('No package.json found; falling back to direct package manager add')
      );
    }

    if (stagedPackages.length > 0) {
      const installSuccess = installDependencies(directory, packageManager);
      if (installSuccess) {
        console.log(chalk.green('✓ Installed dependencies from package.json'));
      } else {
        console.log(chalk.red('✗ Failed to install dependencies from package.json'));
      }
    }

    if (fallbackPackages.length > 0) {
      const prodPackages = fallbackPackages
        .filter((packageRequirement) => !packageRequirement.isDev)
        .map((packageRequirement) => packageRequirement.name);
      const devPackages = fallbackPackages
        .filter((packageRequirement) => packageRequirement.isDev)
        .map((packageRequirement) => packageRequirement.name);

      if (prodPackages.length > 0) {
        const success = installPackagesDirect(
          directory,
          prodPackages,
          packageManager,
          false
        );
        if (success) {
          console.log(chalk.green(`✓ Installed ${prodPackages.join(', ')}`));
        } else {
          console.log(chalk.red(`✗ Failed to install ${prodPackages.join(', ')}`));
        }
      }

      if (devPackages.length > 0) {
        const success = installPackagesDirect(
          directory,
          devPackages,
          packageManager,
          true
        );
        if (success) {
          console.log(chalk.green(`✓ Installed ${devPackages.join(', ')}`));
        } else {
          console.log(chalk.red(`✗ Failed to install ${devPackages.join(', ')}`));
        }
      }
    }

    console.log();
  }

  console.log(`\n${chalk.bold('Summary:')}`);
  console.log(`${chalk.green('✓')} Processed: ${processed}`);
  console.log(
    `${chalk.gray('⏭️')} Skipped: ${
      filteredConfigFiles.length - packagesToProcess.length
    }`
  );
  console.log(`${chalk.red('✗')} Errors: ${errors}`);

  if (dryRun && processed > 0) {
    console.log(chalk.yellow(`\nRun without --dry-run to apply changes.`));
  }
}

// CLI setup
program
  .name('zephyr-codemod')
  .description('Automatically add Zephyr integration to supported project configs')
  .version('1.0.2')
  .argument('[directory]', 'Directory to search for config files', '.')
  .option('-d, --dry-run', 'Show what would be changed without modifying files')
  .option(
    '-b, --bundlers <bundlers...>',
    'Only process specific bundlers (webpack, vite, rollup, etc.)'
  )
  .action((directory: string, options: CodemodOptions) => {
    runCodemod(directory, options);
  });

// If no arguments provided, run with defaults (current directory)
if (process.argv.length === 2) {
  runCodemod('.', {});
} else {
  program.parse();
}

export { findConfigFiles, runCodemod, transformConfigFile };
