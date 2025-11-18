import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseJsonc } from 'jsonc-parser';
import { cosmiconfig } from 'cosmiconfig';

export interface PackageJsonConfig {
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

export interface TsConfigJson {
  compilerOptions?: {
    outDir?: string;
    rootDir?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Read and parse package.json from the given directory */
export function readPackageJson(cwd: string): PackageJsonConfig | null {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    return parseJsonc(content);
  } catch (error) {
    return null;
  }
}

/** Read and parse tsconfig.json from the given directory */
export function readTsConfig(
  cwd: string,
  configPath = 'tsconfig.json'
): TsConfigJson | null {
  const tsConfigPath = join(cwd, configPath);

  if (!existsSync(tsConfigPath)) {
    return null;
  }

  try {
    const content = readFileSync(tsConfigPath, 'utf-8');
    // Parse JSON with comments support using jsonc-parser
    return parseJsonc(content);
  } catch (error) {
    console.error(`Error reading tsconfig.json: ${error}`);
    return null;
  }
}

/** Check if a file exists and has a .js or .mjs extension */
export function isJavaScriptConfig(cwd: string, baseName: string): boolean {
  const jsExtensions = ['.js', '.mjs', '.cjs'];

  for (const ext of jsExtensions) {
    const configPath = join(cwd, `${baseName}${ext}`);
    if (existsSync(configPath)) {
      return true;
    }
  }

  return false;
}

/** Check if a configuration file exists (any extension) */
export function configFileExists(cwd: string, baseName: string): string | null {
  const extensions = ['.json', '.js', '.mjs', '.cjs', '.ts'];

  for (const ext of extensions) {
    const configPath = join(cwd, `${baseName}${ext}`);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * Generic interface for framework configuration with output directory
 */
export interface FrameworkConfig {
  /** The detected output directory from the config */
  outputDir?: string | null;
  /** The full configuration object (framework-specific) */
  config: any;
  /** The file path where the config was loaded from */
  filepath: string;
}

/**
 * Load Webpack configuration using cosmiconfig
 */
export async function loadWebpackConfig(
  cwd: string
): Promise<FrameworkConfig | null> {
  try {
    const explorer = cosmiconfig('webpack', {
      searchPlaces: [
        'webpack.config.js',
        'webpack.config.mjs',
        'webpack.config.cjs',
        'webpack.config.ts',
      ],
    });

    const result = await explorer.search(cwd);
    if (!result || !result.config) {
      return null;
    }

    // Extract output.path from webpack config
    let outputDir: string | null = null;
    const config = result.config;

    // Handle function configs (they receive env and argv)
    if (typeof config === 'function') {
      try {
        const resolvedConfig = await config({}, { mode: 'production' });
        outputDir = resolvedConfig?.output?.path || null;
      } catch {
        // If function execution fails, we can't extract the output
        outputDir = null;
      }
    } else if (config?.output?.path) {
      outputDir = config.output.path;
    }

    return {
      outputDir,
      config: result.config,
      filepath: result.filepath,
    };
  } catch (error) {
    // If loading fails, return null
    return null;
  }
}

/**
 * Load Vite configuration using cosmiconfig
 */
export async function loadViteConfig(
  cwd: string
): Promise<FrameworkConfig | null> {
  try {
    const explorer = cosmiconfig('vite', {
      searchPlaces: [
        'vite.config.js',
        'vite.config.mjs',
        'vite.config.cjs',
        'vite.config.ts',
      ],
    });

    const result = await explorer.search(cwd);
    if (!result || !result.config) {
      return null;
    }

    // Extract build.outDir from vite config
    let outputDir: string | null = null;
    const config = result.config;

    // Handle function configs (they receive config env)
    if (typeof config === 'function') {
      try {
        const resolvedConfig = await config({ mode: 'production', command: 'build' });
        outputDir = resolvedConfig?.build?.outDir || 'dist';
      } catch {
        outputDir = 'dist'; // Vite default
      }
    } else if (config?.build?.outDir) {
      outputDir = config.build.outDir;
    } else {
      outputDir = 'dist'; // Vite default
    }

    return {
      outputDir,
      config: result.config,
      filepath: result.filepath,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Load Rollup configuration using cosmiconfig
 */
export async function loadRollupConfig(
  cwd: string
): Promise<FrameworkConfig | null> {
  try {
    const explorer = cosmiconfig('rollup', {
      searchPlaces: [
        'rollup.config.js',
        'rollup.config.mjs',
        'rollup.config.cjs',
        'rollup.config.ts',
      ],
    });

    const result = await explorer.search(cwd);
    if (!result || !result.config) {
      return null;
    }

    // Extract output.dir or output.file from rollup config
    let outputDir: string | null = null;
    const config = result.config;

    // Handle function configs
    if (typeof config === 'function') {
      try {
        const resolvedConfig = await config({});
        if (Array.isArray(resolvedConfig)) {
          // Multiple outputs - take the first one
          outputDir = resolvedConfig[0]?.output?.dir || resolvedConfig[0]?.output?.file || null;
        } else {
          outputDir = resolvedConfig?.output?.dir || resolvedConfig?.output?.file || null;
        }
      } catch {
        outputDir = null;
      }
    } else if (Array.isArray(config)) {
      // Multiple outputs - take the first one
      outputDir = config[0]?.output?.dir || config[0]?.output?.file || null;
    } else if (config?.output) {
      const output = Array.isArray(config.output) ? config.output[0] : config.output;
      outputDir = output?.dir || output?.file || null;
    }

    // If outputDir is a file path, extract the directory
    if (outputDir && outputDir.includes('.')) {
      const lastSlash = Math.max(outputDir.lastIndexOf('/'), outputDir.lastIndexOf('\\'));
      if (lastSlash !== -1) {
        outputDir = outputDir.substring(0, lastSlash);
      }
    }

    return {
      outputDir,
      config: result.config,
      filepath: result.filepath,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Load SWC configuration using cosmiconfig
 */
export async function loadSwcConfig(
  cwd: string
): Promise<FrameworkConfig | null> {
  try {
    const explorer = cosmiconfig('swc', {
      searchPlaces: [
        '.swcrc',
        '.swcrc.json',
        '.swcrc.js',
        '.swcrc.mjs',
        '.swcrc.cjs',
      ],
    });

    const result = await explorer.search(cwd);
    if (!result || !result.config) {
      return null;
    }

    // SWC doesn't have a standard output directory config
    // Most projects use a custom output directory
    return {
      outputDir: null,
      config: result.config,
      filepath: result.filepath,
    };
  } catch (error) {
    return null;
  }
}
