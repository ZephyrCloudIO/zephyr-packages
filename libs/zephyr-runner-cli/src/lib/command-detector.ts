import { existsSync } from 'node:fs';
import { join, resolve, relative, dirname, sep } from 'node:path';
import {
  configFileExists,
  isJavaScriptConfig,
  readPackageJson,
  readTsConfig,
  loadWebpackConfig,
  loadViteConfig,
  loadRollupConfig,
  loadSwcConfig,
} from './config-readers';
import type { ParsedCommand } from './shell-parser';
import { parseShellCommand, splitCommands } from './shell-parser';

export interface DetectedCommand {
  /** The build tool detected (e.g., 'tsc', 'webpack', 'npm') */
  tool: string;
  /** The configuration file path, if detected */
  configFile: string | null;
  /** Whether the config file is JavaScript (dynamic config) */
  isDynamicConfig: boolean;
  /** The inferred output directory, if detectable */
  outputDir: string | null;
  /** Warnings to display to the user */
  warnings: string[];
  /** Sub-commands detected when a command expands to multiple commands (e.g., npm script with &&) */
  subCommands?: DetectedCommand[];
}

/**
 * Find the value of a command-line argument, supporting both formats:
 *
 * - `--flag value` (space-separated)
 * - `--flag=value` (equals-separated)
 * - `-f value` (short flag with space)
 * - `-f=value` (short flag with equals)
 */
function findArgValue(args: string[], ...flags: string[]): string | null {
  for (const flag of flags) {
    // Look for space-separated format: --flag value
    const index = args.indexOf(flag);
    if (index !== -1 && index + 1 < args.length) {
      return args[index + 1];
    }

    // Look for equals format: --flag=value
    const prefix = `${flag}=`;
    for (const arg of args) {
      if (arg.startsWith(prefix)) {
        return arg.substring(prefix.length);
      }
    }
  }

  return null;
}

/**
 * Find the common ancestor directory of multiple paths, bounded by the project root.
 *
 * @param paths - Array of absolute paths
 * @param projectRoot - The project root directory (boundary)
 * @returns The common ancestor path, or null if paths are empty or no common ancestor within project root
 */
export function findCommonAncestor(paths: string[], projectRoot: string): string | null {
  if (paths.length === 0) {
    return null;
  }

  if (paths.length === 1) {
    return paths[0];
  }

  // Normalize all paths to absolute
  const normalizedPaths = paths.map(p => resolve(p));
  const normalizedRoot = resolve(projectRoot);

  // Split each path into segments
  const pathSegments = normalizedPaths.map(p => p.split(sep));
  const rootSegments = normalizedRoot.split(sep);

  // Find the common prefix across all paths
  let commonSegments: string[] = [];
  const minLength = Math.min(...pathSegments.map(p => p.length));

  for (let i = 0; i < minLength; i++) {
    const segment = pathSegments[0][i];

    // Check if all paths have the same segment at this position
    if (pathSegments.every(p => p[i] === segment)) {
      commonSegments.push(segment);
    } else {
      break;
    }
  }

  // Ensure the common ancestor is within or equal to the project root
  const commonPath = commonSegments.join(sep) || sep;

  // Check if common path is within project root
  const relativeToRoot = relative(normalizedRoot, commonPath);

  // If relative path starts with '..' or is absolute, it's outside project root
  if (relativeToRoot.startsWith('..') || resolve(commonPath) !== commonPath) {
    return normalizedRoot;
  }

  // If common path is shallower than project root, use project root
  if (commonSegments.length < rootSegments.length) {
    return normalizedRoot;
  }

  return commonPath;
}

/**
 * Detect multiple commands from a command line that may contain shell operators (;, &&).
 * Returns output directories from all detected commands.
 */
export async function detectMultipleCommands(
  commandLine: string,
  cwd: string
): Promise<{
  commands: DetectedCommand[];
  outputDirs: string[];
  commonOutputDir: string | null;
}> {
  const individualCommands = splitCommands(commandLine);
  const detectedCommands: DetectedCommand[] = [];
  const outputDirs: string[] = [];

  for (const cmd of individualCommands) {
    try {
      const parsed = parseShellCommand(cmd);
      const detected = await detectCommand(parsed, cwd);
      detectedCommands.push(detected);

      if (detected.outputDir) {
        const absoluteOutputDir = resolve(cwd, detected.outputDir);
        outputDirs.push(absoluteOutputDir);
      }
    } catch (error) {
      // Skip commands that fail to parse
      console.error(`[ze-cli] Warning: Failed to parse command: ${cmd}`);
    }
  }

  // Find common ancestor of all output directories
  const commonOutputDir = outputDirs.length > 0
    ? findCommonAncestor(outputDirs, cwd)
    : null;

  return {
    commands: detectedCommands,
    outputDirs,
    commonOutputDir,
  };
}

/** Detect the build tool and its configuration from a parsed command */
export async function detectCommand(
  parsed: ParsedCommand,
  cwd: string,
  depth = 0
): Promise<DetectedCommand> {
  const { command, args } = parsed;
  const warnings: string[] = [];

  // Prevent infinite recursion
  if (depth > 3) {
    warnings.push('Max recursion depth reached while parsing scripts');
    return {
      tool: command,
      configFile: null,
      isDynamicConfig: false,
      outputDir: null,
      warnings,
    };
  }

  // Detect npm/yarn/pnpm commands
  if (['npm', 'yarn', 'pnpm'].includes(command)) {
    return await detectPackageManagerCommand(command, args, cwd, warnings, depth);
  }

  // Detect tsc (TypeScript compiler)
  if (command === 'tsc') {
    return detectTscCommand(args, cwd, warnings);
  }

  // Detect webpack
  if (command === 'webpack' || command === 'webpack-cli') {
    return await detectWebpackCommand(cwd, warnings);
  }

  // Detect rollup
  if (command === 'rollup') {
    return await detectRollupCommand(cwd, warnings);
  }

  // Detect esbuild
  if (command === 'esbuild') {
    return detectEsbuildCommand(args, warnings);
  }

  // Detect vite
  if (command === 'vite') {
    return await detectViteCommand(cwd, warnings);
  }

  // Detect swc
  if (command === 'swc') {
    return await detectSwcCommand(cwd, warnings);
  }

  // Unknown command
  return {
    tool: command,
    configFile: null,
    isDynamicConfig: false,
    outputDir: null,
    warnings: [
      `Unknown build tool: ${command}`,
      'Output directory detection may not work correctly.',
    ],
  };
}

async function detectPackageManagerCommand(
  command: string,
  args: string[],
  cwd: string,
  warnings: string[],
  depth: number
): Promise<DetectedCommand> {
  const packageJson = readPackageJson(cwd);

  if (!packageJson) {
    warnings.push('package.json not found');
    return {
      tool: command,
      configFile: null,
      isDynamicConfig: false,
      outputDir: null,
      warnings,
    };
  }

  // Find the script name
  let scriptName: string | null = null;
  if (command === 'npm' && args[0] === 'run' && args[1]) {
    scriptName = args[1];
  } else if ((command === 'yarn' || command === 'pnpm') && args[0]) {
    scriptName = args[0];
  }

  if (!scriptName || !packageJson.scripts?.[scriptName]) {
    warnings.push(`Script "${scriptName || 'unknown'}" not found in package.json`);
    return {
      tool: command,
      configFile: join(cwd, 'package.json'),
      isDynamicConfig: false,
      outputDir: null,
      warnings,
    };
  }

  const script = packageJson.scripts[scriptName];

  // Parse the script command - check if there are multiple commands with shell operators
  try {
    const individualCommands = splitCommands(script);

    // If there are multiple commands in the script, detect each one
    if (individualCommands.length > 1) {
      const detectedCommands: DetectedCommand[] = [];
      const allWarnings: string[] = [...warnings];
      const outputDirs: string[] = [];

      for (const cmd of individualCommands) {
        try {
          const parsedScript = parseShellCommand(cmd);
          const detected = await detectCommand(parsedScript, cwd, depth + 1);
          detectedCommands.push(detected);

          if (detected.outputDir) {
            outputDirs.push(resolve(cwd, detected.outputDir));
          }

          allWarnings.push(...detected.warnings);
        } catch (error) {
          // Skip commands that fail to parse
          allWarnings.push(`Failed to parse sub-command: ${cmd}`);
        }
      }

      // Find the last command that produces output
      let primaryDetected = detectedCommands.find(d => d.outputDir) || detectedCommands[detectedCommands.length - 1];

      // If multiple output directories, use common ancestor
      if (outputDirs.length > 1) {
        const commonOutputDir = findCommonAncestor(outputDirs, cwd);
        if (commonOutputDir) {
          primaryDetected = {
            ...primaryDetected,
            outputDir: relative(cwd, commonOutputDir) || '.',
          };
        }
      } else if (outputDirs.length === 1) {
        primaryDetected = {
          ...primaryDetected,
          outputDir: relative(cwd, outputDirs[0]) || '.',
        };
      }

      // Preserve the package.json reference
      if (!primaryDetected.configFile) {
        primaryDetected.configFile = join(cwd, 'package.json');
      }

      primaryDetected.warnings = allWarnings;
      // Store sub-commands for logging purposes
      primaryDetected.subCommands = detectedCommands;
      return primaryDetected;
    }

    // Single command - parse normally
    const parsedScript = parseShellCommand(script);

    // Recursively detect the actual build tool
    const detected = await detectCommand(parsedScript, cwd, depth + 1);

    // Preserve the package.json reference
    if (!detected.configFile) {
      detected.configFile = join(cwd, 'package.json');
    }

    return detected;
  } catch (error) {
    warnings.push(`Failed to parse package.json script "${scriptName}": ${script}`);
    warnings.push(`Parse error: ${(error as Error).message}`);

    return {
      tool: command,
      configFile: join(cwd, 'package.json'),
      isDynamicConfig: false,
      outputDir: null,
      warnings,
    };
  }
}

function detectTscCommand(
  args: string[],
  cwd: string,
  warnings: string[]
): DetectedCommand {
  // Look for -p or --project flag
  const configPath = findArgValue(args, '-p', '--project') || 'tsconfig.json';

  const fullConfigPath = join(cwd, configPath);
  const configExists = existsSync(fullConfigPath);

  if (!configExists) {
    warnings.push(`TypeScript config not found: ${configPath}`);
    return {
      tool: 'tsc',
      configFile: null,
      isDynamicConfig: false,
      outputDir: null,
      warnings,
    };
  }

  // Try to read outDir from tsconfig
  const tsConfig = readTsConfig(cwd, configPath);
  const outDir = tsConfig?.compilerOptions?.outDir || null;

  return {
    tool: 'tsc',
    configFile: fullConfigPath,
    isDynamicConfig: false,
    outputDir: outDir,
    warnings,
  };
}

async function detectWebpackCommand(
  cwd: string,
  warnings: string[]
): Promise<DetectedCommand> {
  const configFile = configFileExists(cwd, 'webpack.config');
  const isDynamicConfig = isJavaScriptConfig(cwd, 'webpack.config');

  // Try to load the config using cosmiconfig if it's a JS config
  if (isDynamicConfig) {
    try {
      const loadedConfig = await loadWebpackConfig(cwd);

      if (loadedConfig && loadedConfig.outputDir) {
        // Successfully loaded and extracted output directory
        return {
          tool: 'webpack',
          configFile: loadedConfig.filepath,
          isDynamicConfig: true,
          outputDir: loadedConfig.outputDir,
          warnings,
        };
      }

      // Config loaded but couldn't extract output directory
      warnings.push(
        'Webpack configuration loaded but output directory could not be determined.',
        'Consider using @zephyrcloud/webpack-plugin or ze-cli deploy after building.'
      );
    } catch (error) {
      warnings.push(
        'Failed to load Webpack configuration.',
        'Consider using @zephyrcloud/webpack-plugin or ze-cli deploy after building.'
      );
    }
  }

  return {
    tool: 'webpack',
    configFile,
    isDynamicConfig,
    outputDir: isDynamicConfig ? null : 'dist',
    warnings,
  };
}

async function detectRollupCommand(
  cwd: string,
  warnings: string[]
): Promise<DetectedCommand> {
  const configFile = configFileExists(cwd, 'rollup.config');
  const isDynamicConfig = isJavaScriptConfig(cwd, 'rollup.config');

  // Try to load the config using cosmiconfig if it's a JS config
  if (isDynamicConfig) {
    try {
      const loadedConfig = await loadRollupConfig(cwd);

      if (loadedConfig && loadedConfig.outputDir) {
        // Successfully loaded and extracted output directory
        return {
          tool: 'rollup',
          configFile: loadedConfig.filepath,
          isDynamicConfig: true,
          outputDir: loadedConfig.outputDir,
          warnings,
        };
      }

      // Config loaded but couldn't extract output directory
      warnings.push(
        'Rollup configuration loaded but output directory could not be determined.',
        'Consider using @zephyrcloud/rollup-plugin or ze-cli deploy after building.'
      );
    } catch (error) {
      warnings.push(
        'Failed to load Rollup configuration.',
        'Consider using @zephyrcloud/rollup-plugin or ze-cli deploy after building.'
      );
    }
  }

  return {
    tool: 'rollup',
    configFile,
    isDynamicConfig,
    outputDir: isDynamicConfig ? null : 'dist',
    warnings,
  };
}

function detectEsbuildCommand(args: string[], warnings: string[]): DetectedCommand {
  // Look for --outdir or --outfile in args
  let outputDir: string | null = null;

  const outdir = findArgValue(args, '--outdir');
  const outfile = findArgValue(args, '--outfile');

  if (outdir) {
    outputDir = outdir;
  } else if (outfile) {
    // Extract directory from outfile
    const lastSlash = Math.max(outfile.lastIndexOf('/'), outfile.lastIndexOf('\\'));
    outputDir = lastSlash !== -1 ? outfile.substring(0, lastSlash) : '.';
  }

  if (!outputDir) {
    warnings.push('Could not detect esbuild output directory from arguments');
  }

  return {
    tool: 'esbuild',
    configFile: null,
    isDynamicConfig: false,
    outputDir,
    warnings,
  };
}

async function detectViteCommand(
  cwd: string,
  warnings: string[]
): Promise<DetectedCommand> {
  const configFile = configFileExists(cwd, 'vite.config');
  const isDynamicConfig = isJavaScriptConfig(cwd, 'vite.config');

  // Try to load the config using cosmiconfig if it's a JS config
  if (isDynamicConfig) {
    try {
      const loadedConfig = await loadViteConfig(cwd);

      if (loadedConfig && loadedConfig.outputDir) {
        // Successfully loaded and extracted output directory
        return {
          tool: 'vite',
          configFile: loadedConfig.filepath,
          isDynamicConfig: true,
          outputDir: loadedConfig.outputDir,
          warnings,
        };
      }

      // Config loaded but couldn't extract output directory (fallback to default)
      if (loadedConfig) {
        return {
          tool: 'vite',
          configFile: loadedConfig.filepath,
          isDynamicConfig: true,
          outputDir: 'dist', // Vite default
          warnings,
        };
      }

      warnings.push(
        'Failed to load Vite configuration.',
        'Consider using @zephyrcloud/vite-plugin or ze-cli deploy after building.'
      );
    } catch (error) {
      warnings.push(
        'Failed to load Vite configuration.',
        'Consider using @zephyrcloud/vite-plugin or ze-cli deploy after building.'
      );
    }
  }

  return {
    tool: 'vite',
    configFile,
    isDynamicConfig,
    outputDir: isDynamicConfig ? null : 'dist',
    warnings,
  };
}

async function detectSwcCommand(
  cwd: string,
  warnings: string[]
): Promise<DetectedCommand> {
  const configFile = configFileExists(cwd, '.swcrc');
  const isDynamicConfig = isJavaScriptConfig(cwd, '.swcrc');

  // Try to load the config using cosmiconfig if it's a JS config
  if (isDynamicConfig) {
    try {
      const loadedConfig = await loadSwcConfig(cwd);

      if (loadedConfig) {
        return {
          tool: 'swc',
          configFile: loadedConfig.filepath,
          isDynamicConfig: true,
          outputDir: 'dist', // SWC doesn't have standard output config
          warnings,
        };
      }
    } catch (error) {
      warnings.push('Failed to load SWC configuration.');
    }
  }

  return {
    tool: 'swc',
    configFile,
    isDynamicConfig,
    outputDir: 'dist', // Common default
    warnings,
  };
}
