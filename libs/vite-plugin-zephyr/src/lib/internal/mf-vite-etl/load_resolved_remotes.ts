import type { ZeResolvedDependency } from 'zephyr-agent';
import { ze_log } from 'zephyr-agent';
import { parseRuntimePlugin } from './runtime_plugins_parser';
import { generateRuntimePlugin } from './runtime_plugin';

export function load_resolved_remotes(
  resolved_remotes: ZeResolvedDependency[],
  code: string
): string {
  const startTime = Date.now();

  try {
    const runtimePluginsExtraction = parseRuntimePlugin(code);

    if (!runtimePluginsExtraction) return code;

    const { pluginsArray, startIndex, endIndex } = runtimePluginsExtraction;

    // Add Zephyr plugin to the array
    // We need to add a Zephyr plugin to the end of the array
    // The array is in format: [plugin1(), plugin2(), ...] or []
    let updatedPluginsArray;
    const runtimePlugin = generateRuntimePlugin(resolved_remotes);

    if (pluginsArray === '[]') {
      // Handle empty array case
      updatedPluginsArray = `[${runtimePlugin}]`;
    } else {
      // Handle non-empty array case
      updatedPluginsArray = pluginsArray.replace(/\]$/, `, ${runtimePlugin}]`);
    }

    // Replace the original array with the updated one
    const updatedCode =
      code.substring(0, startIndex) + updatedPluginsArray + code.substring(endIndex);

    const endTime = Date.now();
    ze_log(`load_resolved_remotes took ${endTime - startTime}ms`);
    return updatedCode;
  } catch (error) {
    ze_log('Error in load_resolved_remotes:', error);
    return code; // Return original code in case of error
  }
}
