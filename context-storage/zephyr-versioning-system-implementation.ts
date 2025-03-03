/**
 * Zephyr Versioning System - Implementation for versioning ~/.zephyr files
 * to ensure backward compatibility while supporting new features.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Interface for versioned data
 */
interface VersionedData<T> {
  version: string;
  data: T;
}

/**
 * Migration interface for defining data transformations
 */
interface Migration {
  fromVersion: string;
  toVersion: string;
  migrate: <T>(data: VersionedData<T>) => VersionedData<T>;
}

/**
 * Constants
 */
const CURRENT_VERSION = '1.1.0'; // Version that supports MF 2.0
const ZEPHYR_DIR = path.join(os.homedir(), '.zephyr');
const VERSION_FILE = path.join(ZEPHYR_DIR, 'version.json');

/**
 * Feature flags based on versions
 */
enum Feature {
  MF2_MANIFEST = 'mf2-manifest',
  RUNTIME_PLUGINS = 'runtime-plugins',
  FALLBACK_STRATEGIES = 'fallback-strategies',
  VERSION_OVERRIDES = 'version-overrides',
  SERVER_SIDE_RENDERING = 'server-side-rendering'
}

/**
 * Feature support by version
 */
const featureSupport: Record<Feature, string> = {
  [Feature.MF2_MANIFEST]: '1.1.0',
  [Feature.RUNTIME_PLUGINS]: '1.2.0',
  [Feature.FALLBACK_STRATEGIES]: '1.3.0',
  [Feature.VERSION_OVERRIDES]: '1.4.0',
  [Feature.SERVER_SIDE_RENDERING]: '1.5.0'
};

/**
 * Migrations for upgrading data between versions
 */
const migrations: Migration[] = [
  {
    fromVersion: '0.0.0',
    toVersion: '1.0.0',
    migrate: <T>(data: VersionedData<T>): VersionedData<T> => {
      // Migrate from legacy unversioned format to initial versioned format
      return {
        version: '1.0.0',
        data: data.data
      };
    }
  },
  {
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    migrate: <T>(data: VersionedData<T>): VersionedData<T> => {
      // Migrate from 1.0.0 to 1.1.0 (Add MF 2.0 support fields)
      return {
        version: '1.1.0',
        data: data.data
      };
    }
  }
  // Additional migrations can be added as needed
];

/**
 * Zephyr storage manager for versioned data
 */
class ZephyrVersionedStorage {
  private basePath: string;
  
  constructor(basePath: string = ZEPHYR_DIR) {
    this.basePath = basePath;
    this.ensureBaseDir();
    this.ensureVersionFile();
  }
  
  /**
   * Read a file with versioning support
   */
  async read<T>(filePath: string): Promise<VersionedData<T>> {
    const fullPath = path.join(this.basePath, filePath);
    
    try {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      let data: unknown;
      
      try {
        data = JSON.parse(content);
      } catch (e) {
        // File is not valid JSON, return default
        return this.createDefaultData<T>();
      }
      
      if (this.isVersionedData(data)) {
        // Already versioned, check if migration needed
        return this.migrateIfNeeded(data as VersionedData<T>);
      }
      
      // Legacy unversioned data, wrap and migrate
      return this.migrateIfNeeded({
        version: '0.0.0',
        data: data as T
      });
    } catch (error) {
      // File doesn't exist or can't be read, return default
      return this.createDefaultData<T>();
    }
  }
  
  /**
   * Write a file with versioning
   */
  async write<T>(filePath: string, data: T): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    
    const versionedData: VersionedData<T> = {
      version: CURRENT_VERSION,
      data
    };
    
    await fs.promises.writeFile(
      fullPath,
      JSON.stringify(versionedData, null, 2),
      'utf-8'
    );
  }
  
  /**
   * Check if a feature is supported in the current version
   */
  supportsFeature(feature: Feature): boolean {
    return this.isVersionCompatible(CURRENT_VERSION, featureSupport[feature]);
  }
  
  /**
   * Check if a feature is supported in a specific version
   */
  supportsFeatureInVersion(feature: Feature, version: string): boolean {
    return this.isVersionCompatible(version, featureSupport[feature]);
  }
  
  /**
   * Get the global Zephyr version
   */
  async getGlobalVersion(): Promise<string> {
    try {
      const content = await fs.promises.readFile(VERSION_FILE, 'utf-8');
      const data = JSON.parse(content);
      return data.version || '0.0.0';
    } catch (error) {
      // Version file doesn't exist or is invalid
      return '0.0.0';
    }
  }
  
  /**
   * Set the global Zephyr version
   */
  async setGlobalVersion(version: string): Promise<void> {
    await fs.promises.writeFile(
      VERSION_FILE,
      JSON.stringify({ version }, null, 2),
      'utf-8'
    );
  }
  
  /**
   * Migrate all files in the ~/.zephyr directory
   */
  async migrateAll(toVersion: string = CURRENT_VERSION): Promise<void> {
    // Get current global version
    const currentVersion = await this.getGlobalVersion();
    
    if (currentVersion === toVersion) {
      return; // Already at target version
    }
    
    // Find all files recursively
    const files = await this.findAllJsonFiles(this.basePath);
    
    // Migrate each file
    for (const file of files) {
      if (file === VERSION_FILE) {
        continue; // Skip version file
      }
      
      try {
        const relativePath = path.relative(this.basePath, file);
        const data = await this.read<unknown>(relativePath);
        await this.write(relativePath, data.data);
      } catch (error) {
        console.error(`Error migrating file ${file}:`, error);
      }
    }
    
    // Update global version
    await this.setGlobalVersion(toVersion);
  }
  
  /**
   * Find all JSON files in a directory recursively
   */
  private async findAllJsonFiles(dir: string): Promise<string[]> {
    const result: string[] = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const nestedFiles = await this.findAllJsonFiles(fullPath);
        result.push(...nestedFiles);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        result.push(fullPath);
      }
    }
    
    return result;
  }
  
  /**
   * Check if data has version field
   */
  private isVersionedData(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      'data' in data
    );
  }
  
  /**
   * Create default versioned data
   */
  private createDefaultData<T>(): VersionedData<T> {
    return {
      version: CURRENT_VERSION,
      data: {} as T
    };
  }
  
  /**
   * Migrate data if needed
   */
  private migrateIfNeeded<T>(versionedData: VersionedData<T>): VersionedData<T> {
    if (versionedData.version === CURRENT_VERSION) {
      return versionedData;
    }
    
    // Apply migrations in sequence
    const migrationPath = this.getMigrationPath(versionedData.version, CURRENT_VERSION);
    
    return migrationPath.reduce(
      (data, migration) => migration.migrate(data),
      versionedData
    );
  }
  
  /**
   * Get migrations path between two versions
   */
  private getMigrationPath(fromVersion: string, toVersion: string): Migration[] {
    // Create a graph of migrations
    const migrationGraph = new Map<string, string[]>();
    
    for (const migration of migrations) {
      if (!migrationGraph.has(migration.fromVersion)) {
        migrationGraph.set(migration.fromVersion, []);
      }
      
      migrationGraph.get(migration.fromVersion)!.push(migration.toVersion);
    }
    
    // Find shortest path from fromVersion to toVersion using BFS
    const queue: Array<{ version: string; path: Migration[] }> = [
      { version: fromVersion, path: [] }
    ];
    const visited = new Set<string>([fromVersion]);
    
    while (queue.length > 0) {
      const { version, path } = queue.shift()!;
      
      if (version === toVersion) {
        return path;
      }
      
      const neighbors = migrationGraph.get(version) || [];
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          
          const migration = migrations.find(
            m => m.fromVersion === version && m.toVersion === neighbor
          );
          
          if (migration) {
            queue.push({
              version: neighbor,
              path: [...path, migration]
            });
          }
        }
      }
    }
    
    // No path found, return empty array
    return [];
  }
  
  /**
   * Compare versions
   */
  private isVersionCompatible(version: string, requiredVersion: string): boolean {
    const [majorA, minorA, patchA = '0'] = version.split('.').map(Number);
    const [majorB, minorB, patchB = '0'] = requiredVersion.split('.').map(Number);
    
    // Compare major versions first
    if (majorA !== majorB) {
      return majorA > majorB;
    }
    
    // Compare minor versions
    if (minorA !== minorB) {
      return minorA > minorB;
    }
    
    // Compare patch versions
    return patchA >= patchB;
  }
  
  /**
   * Ensure base directory exists
   */
  private ensureBaseDir(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }
  
  /**
   * Ensure version file exists
   */
  private ensureVersionFile(): void {
    if (!fs.existsSync(VERSION_FILE)) {
      fs.writeFileSync(
        VERSION_FILE,
        JSON.stringify({ version: CURRENT_VERSION }, null, 2),
        'utf-8'
      );
    }
  }
}

/**
 * Create a singleton instance of the storage
 */
const zephyrStorage = new ZephyrVersionedStorage();

// Export the versioning system
export {
  ZephyrVersionedStorage,
  VersionedData,
  Migration,
  Feature,
  CURRENT_VERSION,
  zephyrStorage
};