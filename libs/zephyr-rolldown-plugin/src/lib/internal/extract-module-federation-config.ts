import type { InputOptions, Plugin } from 'rolldown';
import { ModuleFederationOptions } from '../zephyr-rolldown-plugin';

/**
 * Extracts the module federation plugin from Rolldown options
 *
 * @param options Rolldown input options
 * @returns The extracted module federation config or undefined if not found
 */
export function extractModuleFederationConfig(
  options: InputOptions
): ModuleFederationOptions | undefined {
  if (!options.plugins) return undefined;

  // Convert plugins to array if it's not already
  const pluginsArray = Array.isArray(options.plugins)
    ? options.plugins
    : [options.plugins].filter(Boolean);

  console.log('Searching for module federation plugin...');

  // Find module federation plugin by name pattern
  for (const plugin of pluginsArray) {
    if (!plugin) continue;

    if ((plugin as any).name === 'builtin:module-federation') {
      console.log('Inspecting plugin:', plugin);

      // Get the plugin options
      const mfOptions = (plugin as any)._options;
      console.log('Module Federation plugin options:', mfOptions);

      return mfOptions as ModuleFederationOptions;
    }
  }

  return undefined;
}
