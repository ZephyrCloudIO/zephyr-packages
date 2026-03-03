import type { ZeResolvedDependency } from 'zephyr-agent';
import { ze_log } from 'zephyr-agent';

// The placeholder used in runtime_plugin.mjs that we'll replace with actual data
const REMOTE_MAP_TEMPLATE = '"__REMOTE_MAP__"';

/**
 * Injects resolved remote dependencies into the remoteEntry.js code by replacing the
 * **REMOTE_MAP** placeholder with actual resolved data.
 *
 * This approach is much more robust than AST parsing because:
 *
 * - Works regardless of minification/bundling changes
 * - No dependency on function name patterns
 * - Handles all import aliasing variations
 * - Simple string replacement instead of complex AST manipulation
 */
export function inject_resolved_remotes_map(
  resolved_remotes: ZeResolvedDependency[],
  code: string
): string {
  const startTime = Date.now();

  try {
    // Check if placeholder exists in the code
    if (!code.includes(REMOTE_MAP_TEMPLATE)) {
      ze_log.mf(
        'Placeholder not found in remoteEntry.js - runtime plugin may not be configured'
      );
      return code;
    }

    // Build the remote map from resolved dependencies
    const remoteMap = Object.fromEntries(
      resolved_remotes.map((remote) => [remote.name, remote])
    );

    // Replace the placeholder with actual JSON data
    // The placeholder is already quoted as '"__REMOTE_MAP__"' so we replace the whole thing
    const updatedCode = code.replace(REMOTE_MAP_TEMPLATE, JSON.stringify(remoteMap));

    const endTime = Date.now();
    ze_log.remotes(`inject_resolved_remotes_map took ${endTime - startTime}ms`);
    ze_log.remotes(
      `Injected ${resolved_remotes.length} resolved remotes into remoteEntry.js`
    );

    return updatedCode;
  } catch (error) {
    ze_log.remotes('Error in inject_resolved_remotes_map:', error);
    return code; // Return original code in case of error
  }
}
