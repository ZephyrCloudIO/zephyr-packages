import type { ZeDependencyPair } from 'zephyr-agent';
import { generateRuntimePlugin } from './runtime-plugin';
import { injectRuntimePlugin } from './runtime-plugins-parser';

/**
 * Injects resolved remote dependencies into Module Federation runtime code This function
 * modifies the runtime initialization to include Zephyr's remote resolver
 */
export function load_resolved_remotes(
  code: string,
  resolvedRemotes: ZeDependencyPair[],
  edgeUrl?: string
): string {
  try {
    // Generate the Zephyr runtime plugin
    const zephyrPlugin = generateRuntimePlugin(resolvedRemotes, edgeUrl);

    // Inject the plugin into the runtime code
    const modifiedCode = injectRuntimePlugin(code, zephyrPlugin);

    console.log('Successfully injected Zephyr runtime plugin');
    return modifiedCode;
  } catch (error) {
    console.warn('Failed to inject resolved remotes:', error);
    return code;
  }
}
