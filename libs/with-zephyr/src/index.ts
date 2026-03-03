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
  rspressConfig,
  repackConfig,
} from './bundlers/index.js';
import type { BundlerConfigs } from './types.js';
import {
  detectPackageManager,
  installPackage,
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
  rspress: rspressConfig,
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

/** Check if a configuration file already has withZephyr */
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

    const result = hasZephyrCall(filePath);
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

/** Transform a configuration file to add withZephyr */
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

    console.log(chalk.green(`✓ Added withZephyr to ${normalizePathForOutput(filePath)}`));
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

  console.log(chalk.bold(`🚀 Zephyr Codemod - Adding withZephyr to bundler configs`));
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

    // Check if already has withZephyr
    if (checkHasZephyr(filePath, config)) {
      console.log(
        chalk.gray(
          `⏭️  Skipping ${normalizePathForOutput(filePath)} (already has withZephyr)`
        )
      );
      continue;
    }

    requiredPackages.set(config.plugin, { name: config.plugin, isDev: true });
    packagesToProcess.push({ filePath, bundlerName, config });
  }

  console.log(chalk.blue(`Found ${filteredConfigFiles.length} configuration file(s):\n`));

  // Check and install missing packages
  if (installPackages && requiredPackages.size > 0 && !dryRun) {
    console.log(chalk.blue(`\n📦 Checking package dependencies...\n`));

    const packageManager = detectPackageManager(directory);
    console.log(chalk.gray(`Detected package manager: ${packageManager}`));

    for (const packageRequirement of requiredPackages.values()) {
      if (!isPackageInstalled(packageRequirement.name, directory)) {
        console.log(chalk.yellow(`Installing ${packageRequirement.name}...`));

        const success = installPackage(
          directory,
          packageRequirement.name,
          packageManager,
          packageRequirement.isDev
        );
        if (success) {
          console.log(chalk.green(`✓ Installed ${packageRequirement.name}`));
        } else {
          console.log(chalk.red(`✗ Failed to install ${packageRequirement.name}`));
        }
      } else {
        console.log(chalk.gray(`✓ ${packageRequirement.name} already installed`));
      }
    }
    console.log();
  } else if (installPackages && requiredPackages.size > 0 && dryRun) {
    console.log(chalk.blue(`\n📦 Packages that would be installed:\n`));
    for (const packageRequirement of requiredPackages.values()) {
      if (!isPackageInstalled(packageRequirement.name, directory)) {
        console.log(chalk.yellow(`  - ${packageRequirement.name}`));
      }
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
  .description('Automatically add withZephyr plugin to bundler configurations')
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
