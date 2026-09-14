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
  isPackageRequirementSatisfied,
  isResolvedPackageRequirementSatisfied,
} from './package-manager.js';
import { bootstrapNextJsVinext, type PackageRequirement } from './nextjs-vinext.js';
import { bootstrapMetroCommands } from './metro-bootstrap.js';
import { bootstrapSlidevVite } from './slidev-vite.js';
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

function isRequirementResolved(packageRequirement: PackageRequirement): boolean {
  const projectDirectory = packageRequirement.projectDirectory ?? process.cwd();
  const minimumVersion = packageRequirement.version?.match(/^\^(\d+\.\d+\.\d+)$/)?.[1];
  const maximumVersionExclusive =
    packageRequirement.name === '@module-federation/metro' ? '3.0.0' : undefined;
  return isResolvedPackageRequirementSatisfied(
    packageRequirement.name,
    projectDirectory,
    minimumVersion,
    maximumVersionExclusive
  );
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

  const configFiles = findConfigFiles(directory);

  const nextJsBootstrap = bootstrapNextJsVinext(directory, { dryRun });
  const slidevBootstrapRequested =
    !bundlers || bundlers.includes('vite') || bundlers.includes('slidev');
  const slidevBootstrap = slidevBootstrapRequested
    ? bootstrapSlidevVite(directory, { dryRun })
    : {
        isSlidevApp: false,
        createdFiles: [],
        updatedPackageJson: false,
        packageRequirements: [] as PackageRequirement[],
      };
  const metroProjects = new Map<string, string[]>();
  for (const { bundlerName, filePath } of configFiles) {
    if (bundlerName !== 'metro') continue;
    const projectDirectory = path.resolve(path.dirname(filePath));
    metroProjects.set(projectDirectory, [
      ...(metroProjects.get(projectDirectory) ?? []),
      path.resolve(filePath),
    ]);
  }
  const metroBootstraps =
    !bundlers || bundlers.includes('metro')
      ? [...metroProjects].map(([projectDirectory, metroConfigFilePaths]) => ({
          projectDirectory,
          result: bootstrapMetroCommands(projectDirectory, {
            dryRun,
            metroConfigFilePaths,
          }),
        }))
      : [];

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

  if (slidevBootstrap.isSlidevApp) {
    if (slidevBootstrap.createdFiles.length > 0) {
      for (const createdFile of slidevBootstrap.createdFiles) {
        const message = dryRun
          ? `Would create ${createdFile} for Slidev`
          : `Created ${createdFile} for Slidev`;
        console.log(chalk.green(`✓ ${message}`));
      }
    }
    if (slidevBootstrap.updatedPackageJson) {
      const message = dryRun
        ? 'Would update package.json name/version for Zephyr compatibility'
        : 'Updated package.json name/version for Zephyr compatibility';
      console.log(chalk.green(`✓ ${message}`));
    }
    if (slidevBootstrap.createdFiles.length > 0 || slidevBootstrap.updatedPackageJson) {
      console.log();
    }
  }

  for (const { projectDirectory, result } of metroBootstraps) {
    const displayPath = (fileName: string) =>
      normalizePathForOutput(
        path.relative(path.resolve(directory), path.join(projectDirectory, fileName))
      );
    for (const createdFile of result.createdFiles) {
      console.log(
        chalk.green(
          `✓ ${dryRun ? 'Would create' : 'Created'} ${displayPath(createdFile)}`
        )
      );
    }
    for (const updatedFile of result.updatedFiles) {
      console.log(
        chalk.green(
          `✓ ${dryRun ? 'Would update' : 'Updated'} ${displayPath(updatedFile)}`
        )
      );
    }
    if (result.manualGuidance.length > 0) {
      console.log(
        chalk.yellow(
          `\nMetro publication command registration requires manual setup in ${normalizePathForOutput(path.relative(path.resolve(directory), projectDirectory) || '.')}:`
        )
      );
      for (const line of result.manualGuidance) {
        console.log(chalk.yellow(line));
      }
      console.log();
    } else if (result.createdFiles.length > 0 || result.updatedFiles.length > 0) {
      console.log();
    }
  }

  if (
    configFiles.length === 0 &&
    !nextJsBootstrap.isNextJsApp &&
    !slidevBootstrap.isSlidevApp
  ) {
    console.log(chalk.yellow('No bundler configuration files found.'));
    return;
  }

  // Collect unique plugins that need to be installed
  const requiredPackages = new Map<string, PackageRequirement>();
  const packagesToProcess: ConfigFile[] = [];
  const filteredConfigFiles: ConfigFile[] = [];
  const addRequiredPackage = (packageRequirement: PackageRequirement) => {
    const projectDirectory = path.resolve(
      packageRequirement.projectDirectory ?? directory
    );
    const key = `${projectDirectory}\0${packageRequirement.name}`;
    const existing = requiredPackages.get(key);
    requiredPackages.set(key, {
      ...existing,
      ...packageRequirement,
      projectDirectory,
      isDev: existing
        ? existing.isDev && packageRequirement.isDev
        : packageRequirement.isDev,
      requireResolved: existing?.requireResolved || packageRequirement.requireResolved,
    });
  };
  const getPackageDeclaration = (packageRequirement: PackageRequirement) => {
    const projectDirectory = packageRequirement.projectDirectory ?? directory;
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(projectDirectory, 'package.json'), 'utf8')
      );
      const depType = packageRequirement.isDev ? 'devDependencies' : 'dependencies';
      const oppositeDepType = packageRequirement.isDev
        ? 'dependencies'
        : 'devDependencies';
      const dependencies = packageJson[depType] ?? {};
      const oppositeDependencies = packageJson[oppositeDepType] ?? {};
      const inRequiredSection = Object.hasOwn(dependencies, packageRequirement.name);
      const inOppositeSection = Object.hasOwn(
        oppositeDependencies,
        packageRequirement.name
      );
      return {
        version: (inRequiredSection ? dependencies : oppositeDependencies)[
          packageRequirement.name
        ] as string | undefined,
        inRequiredSection,
        inOppositeSection,
      };
    } catch {
      return {
        version: undefined,
        inRequiredSection: false,
        inOppositeSection: false,
      };
    }
  };

  for (const packageRequirement of nextJsBootstrap.packageRequirements) {
    addRequiredPackage(packageRequirement);
  }
  for (const packageRequirement of slidevBootstrap.packageRequirements) {
    addRequiredPackage(packageRequirement);
  }
  for (const { result } of metroBootstraps) {
    for (const packageRequirement of result.packageRequirements) {
      addRequiredPackage(packageRequirement);
    }
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

    addRequiredPackage({
      name: config.plugin,
      isDev: true,
      ...(bundlerName === 'metro'
        ? {
            version: '^1.4.0',
            projectDirectory: path.resolve(path.dirname(filePath)),
          }
        : {}),
    });
    packagesToProcess.push({ filePath, bundlerName, config });
  }

  console.log(chalk.blue(`Found ${filteredConfigFiles.length} configuration file(s):\n`));
  const missingPackages: PackageRequirement[] = [];
  const packagesToRelocate = new Set<PackageRequirement>();
  if (installPackages) {
    for (const packageRequirement of requiredPackages.values()) {
      const projectDirectory = packageRequirement.projectDirectory ?? directory;
      const minimumVersion =
        packageRequirement.version?.match(/^\^(\d+\.\d+\.\d+)$/)?.[1];
      const satisfied = packageRequirement.requireResolved
        ? isPackageRequirementSatisfied(
            packageRequirement.name,
            projectDirectory,
            minimumVersion
          ) && isRequirementResolved(packageRequirement)
        : packageRequirement.version
          ? isPackageRequirementSatisfied(
              packageRequirement.name,
              projectDirectory,
              minimumVersion
            )
          : isPackageInstalled(packageRequirement.name, projectDirectory);
      const declaration = getPackageDeclaration(packageRequirement);
      const correctlyPlaced =
        declaration.inRequiredSection && !declaration.inOppositeSection;
      if (!satisfied || !correctlyPlaced) {
        if (satisfied && declaration.version !== undefined) {
          packagesToRelocate.add(packageRequirement);
        }
        missingPackages.push(packageRequirement);
      }
    }
  }

  if (installPackages && missingPackages.length > 0 && dryRun) {
    console.log(chalk.blue(`\n📦 Packages that would be installed:\n`));
    for (const packageRequirement of missingPackages) {
      const declaration = getPackageDeclaration(packageRequirement).version;
      const version = /^(?:catalog:|workspace:)/.test(declaration ?? '')
        ? declaration
        : packageRequirement.version;
      console.log(
        chalk.yellow(
          `  - ${packageRequirement.name}${version ? `@${version}` : ''}${packageRequirement.projectDirectory && path.resolve(packageRequirement.projectDirectory) !== path.resolve(directory) ? ` (${normalizePathForOutput(path.relative(path.resolve(directory), packageRequirement.projectDirectory))})` : ''}`
        )
      );
    }
    console.log();
  }

  // Process configuration files
  let processed = 0;
  let errors = 0;
  let dependencyInstallFailed = false;

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

    const stagedPackages: PackageRequirement[] = [];
    const fallbackPackages: PackageRequirement[] = [];

    for (const packageRequirement of missingPackages) {
      const projectDirectory = packageRequirement.projectDirectory ?? directory;
      const packageJsonPath = path.join(projectDirectory, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const declaration = getPackageDeclaration(packageRequirement).version;
        const isManagedDeclaration = /^(?:catalog:|workspace:)/.test(declaration ?? '');
        const preserveDeclaration =
          isManagedDeclaration || packagesToRelocate.has(packageRequirement);
        const version =
          (preserveDeclaration ? declaration : packageRequirement.version) ??
          getLatestVersion(packageRequirement.name);
        const added = addToPackageJson(
          projectDirectory,
          packageRequirement.name,
          version,
          packageRequirement.isDev,
          preserveDeclaration
        );
        if (added) {
          stagedPackages.push(packageRequirement);
          console.log(
            chalk.green(
              `✓ ${preserveDeclaration ? `Preserved ${packageRequirement.name}@${declaration} in` : `Added ${packageRequirement.name} to`} ${normalizePathForOutput(path.relative(path.resolve(directory), packageJsonPath) || 'package.json')}`
            )
          );
        } else if (path.resolve(projectDirectory) === path.resolve(directory)) {
          fallbackPackages.push(packageRequirement);
          console.log(
            chalk.red(
              `✗ Failed to stage ${packageRequirement.name} in package.json, falling back`
            )
          );
        } else {
          console.log(
            chalk.red(
              `✗ Failed to stage ${packageRequirement.name} in ${normalizePathForOutput(path.relative(path.resolve(directory), packageJsonPath))}`
            )
          );
          errors++;
          dependencyInstallFailed = true;
        }
      } else if (path.resolve(projectDirectory) === path.resolve(directory)) {
        fallbackPackages.push(packageRequirement);
      } else {
        console.log(
          chalk.red(
            `✗ No package.json found for ${normalizePathForOutput(path.relative(path.resolve(directory), projectDirectory))}`
          )
        );
        errors++;
        dependencyInstallFailed = true;
      }
    }
    if (fallbackPackages.length > 0) {
      console.log(
        chalk.yellow('No package.json found; falling back to direct package manager add')
      );
    }

    if (stagedPackages.length > 0) {
      const installSuccess = installDependencies(directory, packageManager);
      if (installSuccess) {
        console.log(chalk.green('✓ Installed dependencies from package.json'));

        const nestedProjects = new Map<string, PackageRequirement[]>();
        for (const packageRequirement of stagedPackages) {
          const projectDirectory = path.resolve(
            packageRequirement.projectDirectory ?? directory
          );
          if (projectDirectory === path.resolve(directory)) continue;
          nestedProjects.set(projectDirectory, [
            ...(nestedProjects.get(projectDirectory) ?? []),
            packageRequirement,
          ]);
        }
        for (const [projectDirectory, requirements] of nestedProjects) {
          const isUnresolved = (packageRequirement: PackageRequirement) =>
            !isRequirementResolved(packageRequirement);
          const unresolved = requirements.filter(isUnresolved);
          if (unresolved.length === 0) continue;

          const nestedPackageManager = detectPackageManager(projectDirectory, {
            ignoreUserAgent: true,
          });
          const nestedInstallSuccess = installDependencies(
            projectDirectory,
            nestedPackageManager
          );
          const stillUnresolved = nestedInstallSuccess
            ? unresolved.filter(isUnresolved)
            : unresolved;
          if (nestedInstallSuccess && stillUnresolved.length === 0) {
            console.log(
              chalk.green(
                `✓ Installed dependencies in ${normalizePathForOutput(path.relative(path.resolve(directory), projectDirectory))}`
              )
            );
          } else if (!nestedInstallSuccess) {
            console.log(
              chalk.red(
                `✗ Failed to install dependencies in ${normalizePathForOutput(path.relative(path.resolve(directory), projectDirectory))}`
              )
            );
            errors += stillUnresolved.length;
            dependencyInstallFailed = true;
          } else {
            console.log(
              chalk.red(
                `✗ Installed dependencies in ${normalizePathForOutput(path.relative(path.resolve(directory), projectDirectory))}, but ${stillUnresolved.map(({ name }) => name).join(', ')} still cannot be resolved at compatible versions`
              )
            );
            errors += stillUnresolved.length;
            dependencyInstallFailed = true;
          }
        }
      } else {
        console.log(chalk.red('✗ Failed to install dependencies from package.json'));
        errors += stagedPackages.length;
        dependencyInstallFailed = true;
      }
    }

    if (fallbackPackages.length > 0) {
      const prodPackages = fallbackPackages
        .filter((packageRequirement) => !packageRequirement.isDev)
        .map((packageRequirement) =>
          packageRequirement.version
            ? `${packageRequirement.name}@${packageRequirement.version}`
            : packageRequirement.name
        );
      const devPackages = fallbackPackages
        .filter((packageRequirement) => packageRequirement.isDev)
        .map((packageRequirement) =>
          packageRequirement.version
            ? `${packageRequirement.name}@${packageRequirement.version}`
            : packageRequirement.name
        );

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
          errors += prodPackages.length;
          dependencyInstallFailed = true;
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
          errors += devPackages.length;
          dependencyInstallFailed = true;
        }
      }
    }

    console.log();
  }

  if (!dryRun && !dependencyInstallFailed) {
    for (const { projectDirectory, result } of metroBootstraps) {
      if (result.manualGuidance.length > 0 || result.integration === 'none') continue;
      const unresolved = result.packageRequirements.filter(
        (packageRequirement) => !isRequirementResolved(packageRequirement)
      );
      if (unresolved.length === 0) continue;
      console.log(
        chalk.red(
          `✗ Cannot publish from ${normalizePathForOutput(path.relative(path.resolve(directory), projectDirectory) || '.')}: ${unresolved.map(({ name }) => name).join(', ')} cannot be resolved at compatible versions`
        )
      );
      errors += unresolved.length;
      dependencyInstallFailed = true;
    }
  }

  if (!dryRun && !dependencyInstallFailed) {
    for (const { projectDirectory, result } of metroBootstraps) {
      if (result.manualGuidance.length > 0 || result.integration === 'none') {
        continue;
      }
      const command =
        result.integration === 'rnef'
          ? `rnef bundle-mf-remote --platform ${result.platformArgument} --dev false`
          : `npx react-native bundle-mf-remote --platform ${result.platformArgument} --dev false`;
      const relativeProjectDirectory = normalizePathForOutput(
        path.relative(path.resolve(directory), projectDirectory)
      );
      const projectPrefix = relativeProjectDirectory
        ? `cd "${relativeProjectDirectory}" && `
        : '';
      console.log(
        chalk.blue(`Publish the first bundle with: ${projectPrefix}${command}`)
      );
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

  if (dependencyInstallFailed) {
    process.exitCode = 1;
  }

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
