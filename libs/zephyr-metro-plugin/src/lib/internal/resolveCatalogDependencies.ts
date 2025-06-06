import * as fs from 'fs';
import * as path from 'path';
import { ze_log } from 'zephyr-agent';
import { safe_json_parse } from 'zephyr-edge-contract';

/** Type definition for pnpm-workspace.yaml catalogs section */
interface PnpmCatalogs {
  [catalogName: string]: {
    [packageName: string]: string;
  };
}

/** Interface for pnpm-workspace.yaml */
interface PnpmWorkspace {
  packages?: string[];
  catalogs?: PnpmCatalogs;
}

/** Cache for workspace config to avoid repeated file reads */
let workspaceConfigCache: PnpmWorkspace | null = null;

/** Cache for workspace packages to avoid repeated file scanning */
let workspacePackagesCache: Map<string, any> | null = null;

/**
 * Reads the pnpm-workspace.yaml file to get catalog definitions
 *
 * @param workspacePath Optional path to the workspace file
 * @returns The parsed pnpm workspace configuration
 */
function readWorkspaceConfig(workspacePath?: string): PnpmWorkspace {
  if (workspaceConfigCache) {
    return workspaceConfigCache;
  }

  // Try to find pnpm-workspace.yaml in current directory or parent directories
  const searchPath = workspacePath || findWorkspaceFile();
  if (!searchPath) {
    ze_log('Warning: Could not find pnpm-workspace.yaml file');
    return {};
  }

  try {
    // Using require would be simpler, but we'll use fs to read and YAML parse
    // for more explicit error handling and to avoid needing yaml package
    const yaml = fs.readFileSync(searchPath, 'utf8');
    const config = parseYaml(yaml);
    workspaceConfigCache = config;
    return config;
  } catch (error) {
    ze_log('Error reading pnpm-workspace.yaml:', error);
    return {};
  }
}

/**
 * Simple YAML parser for pnpm-workspace.yaml This is a basic implementation that handles
 * the format we expect in pnpm-workspace.yaml
 */
function parseYaml(yaml: string): PnpmWorkspace {
  const result: PnpmWorkspace = {};
  let currentSection: string | null = null;
  let currentSubsection: string | null = null;

  const lines = yaml.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip comments and empty lines
    if (trimmedLine.startsWith('#') || !trimmedLine) {
      continue;
    }

    // Check for main sections
    if (trimmedLine.endsWith(':')) {
      currentSection = trimmedLine.slice(0, -1);
      if (!currentSection) {
        currentSubsection = null;
      }

      if (currentSection === 'catalogs') {
        result.catalogs = {};
      }

      if (currentSection === 'packages') {
        result.packages = [];
      }

      // Get the catalog's name
      if (trimmedLine.endsWith(':') && currentSection !== 'catalogs' && result.catalogs) {
        currentSubsection = trimmedLine.trim().slice(0, -1);
        result.catalogs[currentSubsection] = {};
      }
    }

    // Parse packages section
    if (currentSection === 'packages' && trimmedLine.startsWith('-')) {
      const pattern = trimmedLine.slice(1).trim();
      // Remove quotes if present
      const cleanPattern = pattern.replace(/^['"]|['"]$/g, '');
      if (!result.packages) {
        result.packages = [];
      }
      result.packages.push(cleanPattern);
    }

    // Get the key and value from the line (at here should be npm dependency name)
    if (trimmedLine.includes(':') && currentSection !== 'catalogs' && result.catalogs) {
      if (currentSubsection) {
        const [key, value] = trimmedLine.split(':', 2).map((part) => part.trim());
        // remove all the double quotes and single quotes and replace them with '\'', because this is affecting the replacement
        const cleanedKey = key.replace(/['"]/g, '');
        result.catalogs[currentSubsection][cleanedKey] = value;
      }
    }
  }

  return result;
}

/**
 * Finds the pnpm-workspace.yaml file by looking in the current directory and traversing
 * up the directory tree
 */
function findWorkspaceFile(): string | null {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const workspacePath = path.join(currentDir, 'pnpm-workspace.yaml');
    if (fs.existsSync(workspacePath)) {
      return workspacePath;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Gets the workspace root directory by finding the directory containing the
 * pnpm-workspace.yaml file
 */
function getWorkspaceRoot(): string | null {
  const workspaceFile = findWorkspaceFile();
  if (!workspaceFile) {
    return null;
  }
  return path.dirname(workspaceFile);
}

/**
 * Find package.json files in a directory according to glob-like patterns This is a custom
 * implementation to replace glob.sync
 *
 * @param rootDir The root directory to start searching from
 * @param includePattern The pattern to include (e.g., "libs/**")
 * @param excludePatterns Array of patterns to exclude
 * @returns Array of absolute paths to matching package.json files
 */
function findPackageJsonFiles(
  rootDir: string,
  includePattern: string,
  excludePatterns: string[] = []
): string[] {
  const results: string[] = [];

  // Convert glob-like pattern to regex pattern for matching
  const patternParts = includePattern.split('/');
  const baseDir = patternParts[0] === '**' ? '' : patternParts[0];
  const hasDoubleGlob = includePattern.includes('**');

  // Build the full base path
  const basePath = path.join(rootDir, baseDir);

  // Check if the base directory exists
  if (!fs.existsSync(basePath) || !fs.statSync(basePath).isDirectory()) {
    return [];
  }

  // Function to check if a path should be excluded
  const isExcluded = (filePath: string): boolean => {
    const relativePath = path.relative(rootDir, filePath);
    return excludePatterns.some((pattern) => {
      // Remove the ! from negated patterns
      const cleanPattern = pattern.startsWith('!') ? pattern.slice(1) : pattern;

      // Simple string matching for exact paths or basic wildcards
      if (cleanPattern.endsWith('/**')) {
        const prefix = cleanPattern.slice(0, -3);
        return relativePath.startsWith(prefix);
      }

      return (
        relativePath === cleanPattern ||
        (cleanPattern.includes('*') &&
          relativePath.startsWith(cleanPattern.split('*')[0]))
      );
    });
  };

  // Recursive function to find package.json files
  const findRecursively = (dir: string, depth = 0): void => {
    if (isExcluded(dir)) {
      return;
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (isExcluded(fullPath)) {
          continue;
        }

        if (entry.isDirectory() && (hasDoubleGlob || depth < patternParts.length)) {
          // Recurse into directories if we have ** or haven't reached max depth
          findRecursively(fullPath, depth + 1);
        } else if (entry.name === 'package.json') {
          results.push(fullPath);
        }
      }
    } catch (error) {
      ze_log(`Error reading directory ${dir}:`, error);
    }
  };

  // Start the recursive search
  findRecursively(basePath);
  return results;
}

/**
 * Finds all package.json files in the workspace based on the patterns specified in the
 * pnpm-workspace.yaml file
 */
function findWorkspacePackages(): Map<string, any> {
  // Return cached result if available
  if (workspacePackagesCache) {
    return workspacePackagesCache;
  }

  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    ze_log('Warning: Could not find workspace root directory');
    return new Map();
  }

  const config = readWorkspaceConfig();
  if (!config.packages || config.packages.length === 0) {
    ze_log('Warning: No workspace packages defined in pnpm-workspace.yaml');
    return new Map();
  }

  const packageJsonMap = new Map<string, any>();
  const includePatterns: string[] = [];
  const excludePatterns: string[] = [];

  // Separate include and exclude patterns
  for (const pattern of config.packages) {
    if (pattern.startsWith('!')) {
      excludePatterns.push(pattern.slice(1));
    } else {
      includePatterns.push(pattern);
    }
  }

  // Process include patterns
  for (const includePattern of includePatterns) {
    try {
      // Use our own file finder instead of glob
      const packageJsonPaths = findPackageJsonFiles(
        workspaceRoot,
        includePattern,
        excludePatterns
      );

      // Read each package.json file
      for (const packageJsonPath of packageJsonPaths) {
        try {
          const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
          const packageJson = safe_json_parse<any>(packageJsonContent);

          if (packageJson && packageJson.name) {
            packageJsonMap.set(packageJson.name, packageJson);
          }
        } catch (error) {
          ze_log(`Error reading package.json at ${packageJsonPath}:`, error);
        }
      }
    } catch (error) {
      ze_log(`Error processing pattern ${includePattern}:`, error);
    }
  }

  // Cache the result
  workspacePackagesCache = packageJsonMap;
  return packageJsonMap;
}

/**
 * Resolves a workspace:* dependency by finding the package in the workspace
 *
 * @param packageName The name of the package to find in the workspace
 * @returns The version of the package, or null if not found
 */
function resolveWorkspaceVersion(packageName: string): string | null {
  const workspacePackages = findWorkspacePackages();

  if (workspacePackages.has(packageName)) {
    return workspacePackages.get(packageName)?.version || null;
  }

  return null;
}

/**
 * Resolves a catalog dependency version string (e.g., "catalog:react18") to its actual
 * semver version range from pnpm-workspace.yaml
 *
 * @param versionString The version string to resolve
 * @param packageName Optional package name to look up specific package in catalog
 * @returns The resolved semver version or the original version if not a catalog reference
 */
export function resolveCatalogVersion(
  versionString: string,
  packageName?: string
): string {
  // If it's not a catalog reference, return as is
  if (
    !versionString ||
    typeof versionString !== 'string' ||
    !versionString.startsWith('catalog:')
  ) {
    return versionString;
  }

  // Extract catalog name from format "catalog:catalogName"
  const catalogName = versionString.substring(8); // Remove "catalog:" prefix

  // Read workspace config to get catalog information
  const config = readWorkspaceConfig();

  // If no catalogs section or the specified catalog doesn't exist
  if (!config.catalogs || !Object.keys(config.catalogs).includes(catalogName)) {
    ze_log(`Warning: Catalog "${catalogName}" not found in pnpm-workspace.yaml`);
    return versionString; // Return the original version string as fallback
  }

  // If a package name is provided, look for that specific package in the catalog
  if (packageName && config.catalogs[catalogName][packageName]) {
    return config.catalogs[catalogName][packageName];
  }

  // Return an object representation of all versions in this catalog
  // This is useful for module federation shared config
  return JSON.stringify(config.catalogs[catalogName]);
}

/**
 * Gets all packages with their versions for a specific catalog
 *
 * @param catalogName The name of the catalog
 * @returns Object mapping package names to their versions, or null if catalog not found
 */
export function getCatalogPackages(catalogName: string): Record<string, string> | null {
  // Read workspace config to get catalog information
  const config = readWorkspaceConfig();

  // If no catalogs section or the specified catalog doesn't exist
  if (!config.catalogs || !Object.keys(config.catalogs).includes(catalogName)) {
    ze_log(`Warning: Catalog "${catalogName}" not found in pnpm-workspace.yaml`);
    return null;
  }

  return config.catalogs[catalogName];
}

/**
 * Resolves a dependency versions object, looking for catalog: references and replacing
 * them with the actual semver version ranges
 *
 * @param dependencies Package dependencies object (e.g., from package.json)
 * @returns New dependencies object with resolved versions
 */
export function resolveCatalogDependencies(
  dependencies: Record<string, string> | undefined
): Record<string, string> {
  if (!dependencies) return {};

  const result: Record<string, string> = {};

  for (const [name, version] of Object.entries(dependencies)) {
    if (version && typeof version === 'string' && version.startsWith('catalog:')) {
      const catalogName = version.substring(8);
      const catalogPackages = getCatalogPackages(catalogName);

      if (catalogPackages && catalogPackages[name]) {
        // Use the specific package version from the catalog
        result[name] = catalogPackages[name];
      } else {
        // If the exact package isn't in the catalog, keep the original for backward compatibility
        result[name] = version;
        ze_log(
          `Warning: Package ${name} not found in catalog ${catalogName}, using original reference`
        );
      }
    } else if (version === 'workspace:*') {
      // Handle workspace references by finding the package in the workspace
      const resolvedVersion = resolveWorkspaceVersion(name);
      if (resolvedVersion) {
        result[name] = resolvedVersion;
      } else {
        // If the package isn't found in the workspace, keep the original
        result[name] = version;
        ze_log(
          `Warning: Package ${name} not found in workspace, using original reference`
        );
      }
    } else if (version && typeof version === 'string') {
      // Handle normal semver
      result[name] = version;
    } else if (version) {
      // Handle other non-standard formats by stringifying
      result[name] = String(version);
    } else {
      // Fallback for edge cases
      result[name] = '*';
      ze_log(`Warning: No valid version found for ${name}, it's using wildcard '*'`);
    }
  }

  return result;
}

export function getPackageDependencies(
  dependencies: Record<string, string> | undefined
): Array<{ name: string; version: string }> {
  if (!dependencies) return [];
  return Object.entries(dependencies).map(([name, version]) => ({ name, version }));
}

/**
 * Extracts exposed modules from Module Federation configuration Creates formatted module
 * entries for the build stats
 */
export function extractModulesFromExposes(
  mfConfig: any | undefined,
  applicationID: string
): Array<{
  id: string;
  name: string;
  applicationID: string;
  requires: string[];
  file: string;
}> {
  if (!mfConfig?.exposes) {
    return [];
  }

  // Extract exposed modules from the Module Federation config
  return Object.entries(mfConfig.exposes).map(([exposedPath, filePath]) => {
    // Handle different formats of exposes configuration
    // In Vite ModuleFederation, exposes can be an object where key is the exposed path and value is the file path
    // Example: { './Button': './src/Button' }

    // Normalize the file path (it might be an object in some federation implementations)
    const normalizedFilePath =
      typeof filePath === 'string'
        ? filePath
        : typeof filePath === 'object' && filePath !== null && 'import' in filePath
          ? String((filePath as { import: string }).import)
          : String(filePath);

    // Extract just the module name from the exposed path (removing './')
    const name = exposedPath.startsWith('./') ? exposedPath.substring(2) : exposedPath;

    // Create a unique ID for this module in the format used by Module Federation Dashboard
    const id = `${name}:${name}`;

    // Extract any potential requirements from shared dependencies
    // In a more complete implementation, this would analyze the actual file to find imports
    const requires: string[] = [];

    // If we have shared dependencies and they're an object with keys, use them as requirements
    if (mfConfig.shared) {
      if (Array.isArray(mfConfig.shared)) {
        // Handle array format: ['react', 'react-dom']
        requires.push(
          ...mfConfig.shared
            .map((item: string | any) => {
              return typeof item === 'string'
                ? item
                : typeof item === 'object' && item !== null && 'libraryName' in item
                  ? String(item.libraryName)
                  : '';
            })
            .filter(Boolean)
        );
      } else if (typeof mfConfig.shared === 'object' && mfConfig.shared !== null) {
        // Handle object format: { react: {...}, 'react-dom': {...} }
        requires.push(...Object.keys(mfConfig.shared));
      }
    }

    // Handle additionalShared format from Nx webpack module federation
    if (mfConfig.additionalShared && Array.isArray(mfConfig.additionalShared)) {
      requires.push(
        ...mfConfig.additionalShared
          .map((item: string | any) =>
            typeof item === 'object' && item !== null && 'libraryName' in item
              ? String(item.libraryName)
              : ''
          )
          .filter(Boolean)
      );
    }

    return {
      id,
      name,
      applicationID,
      requires,
      file: normalizedFilePath,
    };
  });
}
