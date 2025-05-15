import { findAndReplaceVariables } from 'zephyr-agent';
import { ze_log } from 'zephyr-agent';

// Global set to collect environment variables across all modules
// This is needed because loaders can't easily communicate with plugins
const GLOBAL_ENV_VARS = new Set<string>();

/**
 * Loader for processing ZE_ environment variables in source files. This runs during the
 * transform phase, before bundling.
 */
export default function loader(this: any, source: string): string {
  // Skip non-JS/TS files
  const { resourcePath } = this;
  if (!/\.(js|jsx|ts|tsx)$/.test(resourcePath)) {
    return source;
  }

  // Detect and transform environment variables
  const variablesSet = new Set<string>();
  const transformedSource = findAndReplaceVariables(source, variablesSet, [
    'importMetaEnv',
    'processEnv',
  ]);

  // Add detected variables to the global set
  if (variablesSet.size > 0) {
    ze_log(
      `Detected ${variablesSet.size} Zephyr env vars in ${resourcePath}: ${Array.from(variablesSet).join(', ')}`
    );

    // Add to global set
    variablesSet.forEach((v) => GLOBAL_ENV_VARS.add(v));

    // Store on the module for plugin access
    this._module = this._module || {};
    this._module.buildInfo = this._module.buildInfo || {};
    this._module.buildInfo.zeEnvVars = Array.from(variablesSet);
  }

  return transformedSource;
}

// Export access to the global environment variables set
export function getGlobalEnvVars(): Set<string> {
  return GLOBAL_ENV_VARS;
}
