/** Loads TanStack Start build output from .output directory */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { OutputBundle, OutputAsset, OutputChunk } from 'rollup';

/** Recursively get all files in a directory */
async function getAllFiles(dir: string, baseDir?: string): Promise<string[]> {
  baseDir = baseDir || dir;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return getAllFiles(fullPath, baseDir);
      } else {
        return [fullPath];
      }
    })
  );
  return files.flat();
}

/** Load files from directory into Rollup OutputBundle format */
export async function loadFilesFromDirectory(dir: string): Promise<OutputBundle> {
  const bundle: OutputBundle = {};

  try {
    const files = await getAllFiles(dir);

    for (const filePath of files) {
      const relativePath = path.relative(dir, filePath);
      const content = await fs.readFile(filePath);
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath);

      // Determine if this is a code chunk or asset
      const isCode = ext === '.js' || ext === '.mjs' || ext === '.cjs';

      if (isCode) {
        // Create OutputChunk for code files
        const chunk: OutputChunk = {
          type: 'chunk',
          fileName: relativePath,
          name: path.basename(relativePath, ext),
          code: content.toString('utf-8'),
          isEntry: relativePath === 'index.js' || relativePath.includes('index'),
          isDynamicEntry: false,
          facadeModuleId: null,
          moduleIds: [],
          exports: [],
          imports: [],
          dynamicImports: [],
          implicitlyLoadedBefore: [],
          importedBindings: {},
          referencedFiles: [],
          modules: {},
          map: null,
          sourcemapFileName: null,
          preliminaryFileName: relativePath,
          isImplicitEntry: false,
        };
        bundle[relativePath] = chunk;
      } else {
        // Create OutputAsset for non-code files
        const asset: OutputAsset = {
          type: 'asset',
          fileName: relativePath,
          name: relativePath,
          needsCodeReference: false,
          source: content,
          names: [],
          originalFileName: null,
          originalFileNames: [],
        };
        bundle[relativePath] = asset;
      }
    }

    return bundle;
  } catch (error) {
    console.error(`Error loading files from ${dir}:`, error);
    throw error;
  }
}

/**
 * Load TanStack Start build output preserving full directory structure This loads ALL
 * files from the output directory root, maintaining their natural paths (e.g.,
 * server/index.js, client/assets/main.js, favicon.ico)
 */
export async function loadTanStackOutput(outputDir: string): Promise<OutputBundle> {
  // Load from the root output directory to preserve natural structure
  return loadFilesFromDirectory(outputDir);
}

/** @deprecated Use loadTanStackOutput instead - this preserves the full structure */
export async function loadServerOutput(outputDir: string): Promise<OutputBundle> {
  const serverDir = path.join(outputDir, 'server');
  return loadFilesFromDirectory(serverDir);
}

/** @deprecated Use loadTanStackOutput instead - this preserves the full structure */
export async function loadClientOutput(outputDir: string): Promise<OutputBundle> {
  const clientDir = path.join(outputDir, 'client');
  return loadFilesFromDirectory(clientDir);
}

/** Check if TanStack Start output directory exists and is valid */
export async function validateTanStackOutput(outputDir: string): Promise<boolean> {
  try {
    const serverDir = path.join(outputDir, 'server');
    const clientDir = path.join(outputDir, 'client');

    const [serverExists, clientExists] = await Promise.all([
      fs
        .access(serverDir)
        .then(() => true)
        .catch(() => false),
      fs
        .access(clientDir)
        .then(() => true)
        .catch(() => false),
    ]);

    if (!serverExists) {
      console.error(`Server output directory not found: ${serverDir}`);
      return false;
    }

    if (!clientExists) {
      console.warn(`Client output directory not found: ${clientDir}`);
      // Client is optional, might be API-only
    }

    return true;
  } catch (error) {
    console.error('Error validating TanStack output:', error);
    return false;
  }
}
