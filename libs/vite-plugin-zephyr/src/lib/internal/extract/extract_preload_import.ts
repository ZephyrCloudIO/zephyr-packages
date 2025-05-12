import { ze_log } from 'zephyr-agent';
import { extractVitePreloadImports } from '../mf-vite-etl/preload-imports';
import type { ProgramNode } from 'rollup';

/**
 * Extract preload imports from Vite code This is a wrapper around
 * extractVitePreloadImports that can be called directly from other modules.
 */
export function extract_preload_import(ast: ProgramNode, code: string) {
  try {
    const preloadImports = extractVitePreloadImports(ast, code);
    return preloadImports;
  } catch (error) {
    ze_log('Error extracting preload imports', { error });
    return [];
  }
}
