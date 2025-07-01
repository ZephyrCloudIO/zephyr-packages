import { ZephyrRuntimeConstants } from './constants';
import { DependenciesRecord } from './dependencies-record';
import type { VariablesRecord } from './variables-record';

/**
 * Creates the Zephyr runtime file content based on the provided variables and
 * dependencies records.
 */
export function createZephyrRuntimeFile(
  variablesRecord: VariablesRecord | null,
  dependenciesRecord: DependenciesRecord | null
): string | null {
  const hasVariables = !!variablesRecord && Object.keys(variablesRecord).length > 0;
  const hasDependencies =
    !!dependenciesRecord && Object.keys(dependenciesRecord).length > 0;

  // If both records are null, no file is needed
  if (!hasVariables && !hasDependencies) {
    return null;
  }

  const { dependenciesField, envVarsField, globalObject, globalSymbol } =
    ZephyrRuntimeConstants;

  return (
    /* ts */ `

// Ensures window.zephyr-runtime is defined and "hidden" from the global scope
${globalObject}||Object.defineProperty(window,${globalSymbol},{value:{${envVarsField}:{},${dependenciesField}:{}},enumerable:!1,writable:!1});

// Merges all variables and dependencies into the Zephyr runtime global object
Object.assign(${globalObject}.${envVarsField},${variablesRecord ? JSON.stringify(variablesRecord) : '{}'});
// Merges all dependencies into the Zephyr runtime global object
Object.assign(${globalObject}.${dependenciesField},${dependenciesRecord ? JSON.stringify(dependenciesRecord) : '{}'});

  `
      // Removes comment lines
      .replace(/^\s*\/\/.*/gm, '')
      // Removes line breaks added for readability
      .replace(/\n\s*/g, '')
  );
}
