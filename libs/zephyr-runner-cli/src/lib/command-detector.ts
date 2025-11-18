import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  configFileExists,
  isJavaScriptConfig,
  readPackageJson,
  readTsConfig,
} from './config-readers';
import type { ParsedCommand } from './shell-parser';
import { parseShellCommand } from './shell-parser';

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
}

/** Detect the build tool and its configuration from a parsed command */
export function detectCommand(
  parsed: ParsedCommand,
  cwd: string,
  depth = 0
): DetectedCommand {
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
    return detectPackageManagerCommand(command, args, cwd, warnings, depth);
  }

  // Detect tsc (TypeScript compiler)
  if (command === 'tsc') {
    return detectTscCommand(args, cwd, warnings);
  }

  // Detect webpack
  if (command === 'webpack' || command === 'webpack-cli') {
    return detectWebpackCommand(cwd, warnings);
  }

  // Detect rollup
  if (command === 'rollup') {
    return detectRollupCommand(cwd, warnings);
  }

  // Detect esbuild
  if (command === 'esbuild') {
    return detectEsbuildCommand(args, warnings);
  }

  // Detect vite
  if (command === 'vite') {
    return detectViteCommand(cwd, warnings);
  }

  // Detect swc
  if (command === 'swc') {
    return detectSwcCommand(cwd, warnings);
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

function detectPackageManagerCommand(
  command: string,
  args: string[],
  cwd: string,
  warnings: string[],
  depth: number
): DetectedCommand {
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

  // Parse the script command to extract the actual tool
  try {
    const parsedScript = parseShellCommand(script);

    // Recursively detect the actual build tool
    const detected = detectCommand(parsedScript, cwd, depth + 1);

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
  let configPath = 'tsconfig.json';
  const pIndex = args.indexOf('-p');
  const projectIndex = args.indexOf('--project');

  if (pIndex !== -1 && args[pIndex + 1]) {
    configPath = args[pIndex + 1];
  } else if (projectIndex !== -1 && args[projectIndex + 1]) {
    configPath = args[projectIndex + 1];
  }

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

function detectWebpackCommand(cwd: string, warnings: string[]): DetectedCommand {
  const configFile = configFileExists(cwd, 'webpack.config');
  const isDynamicConfig = isJavaScriptConfig(cwd, 'webpack.config');

  if (isDynamicConfig) {
    warnings.push(
      'Webpack configuration is too dynamic to analyze.',
      'Consider using @zephyrcloud/webpack-plugin or ze-cli deploy after building.'
    );
  }

  return {
    tool: 'webpack',
    configFile,
    isDynamicConfig,
    outputDir: isDynamicConfig ? null : 'dist',
    warnings,
  };
}

function detectRollupCommand(cwd: string, warnings: string[]): DetectedCommand {
  const configFile = configFileExists(cwd, 'rollup.config');
  const isDynamicConfig = isJavaScriptConfig(cwd, 'rollup.config');

  if (isDynamicConfig) {
    warnings.push(
      'Rollup configuration is too dynamic to analyze.',
      'Consider using @zephyrcloud/rollup-plugin or ze-cli deploy after building.'
    );
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

  // Check for both --outdir and --outdir=value formats
  const outdirIndex = args.indexOf('--outdir');
  const outfileIndex = args.indexOf('--outfile');

  if (outdirIndex !== -1 && args[outdirIndex + 1]) {
    outputDir = args[outdirIndex + 1];
  } else if (outfileIndex !== -1 && args[outfileIndex + 1]) {
    // Extract directory from outfile
    const outfile = args[outfileIndex + 1];
    const lastSlash = Math.max(outfile.lastIndexOf('/'), outfile.lastIndexOf('\\'));
    outputDir = lastSlash !== -1 ? outfile.substring(0, lastSlash) : '.';
  } else {
    // Check for --outdir=value or --outfile=value format
    for (const arg of args) {
      if (arg.startsWith('--outdir=')) {
        outputDir = arg.substring('--outdir='.length);
        break;
      } else if (arg.startsWith('--outfile=')) {
        const outfile = arg.substring('--outfile='.length);
        const lastSlash = Math.max(outfile.lastIndexOf('/'), outfile.lastIndexOf('\\'));
        outputDir = lastSlash !== -1 ? outfile.substring(0, lastSlash) : '.';
        break;
      }
    }
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

function detectViteCommand(cwd: string, warnings: string[]): DetectedCommand {
  const configFile = configFileExists(cwd, 'vite.config');
  const isDynamicConfig = isJavaScriptConfig(cwd, 'vite.config');

  if (isDynamicConfig) {
    warnings.push(
      'Vite configuration is too dynamic to analyze.',
      'Consider using @zephyrcloud/vite-plugin or ze-cli deploy after building.'
    );
  }

  return {
    tool: 'vite',
    configFile,
    isDynamicConfig,
    outputDir: isDynamicConfig ? null : 'dist',
    warnings,
  };
}

function detectSwcCommand(cwd: string, warnings: string[]): DetectedCommand {
  const configFile = configFileExists(cwd, '.swcrc');
  const isDynamicConfig = isJavaScriptConfig(cwd, '.swcrc');

  return {
    tool: 'swc',
    configFile,
    isDynamicConfig,
    outputDir: 'dist', // Common default
    warnings,
  };
}
