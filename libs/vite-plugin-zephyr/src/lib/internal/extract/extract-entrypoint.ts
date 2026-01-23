import type { ResolvedConfig } from 'vite';
import { ze_log } from 'zephyr-agent';
import { normalizeEntrypoint } from '../utils/normalize-entrypoint';

/**
 * Extracts and normalizes the entrypoint from Vite config.
 *
 * Priority order:
 *
 * 1. User-provided entrypoint option (explicit override)
 * 2. Config.build.rollupOptions.input (auto-detected)
 * 3. 'index.html' (Vite default)
 */
export function extractEntrypoint(
  config: ResolvedConfig,
  userEntrypoint?: string
): string {
  // Priority 1: User explicitly provided entrypoint
  if (userEntrypoint) {
    ze_log.init(`Using user-provided entrypoint: ${userEntrypoint}`);
    return normalizeEntrypoint(userEntrypoint);
  }

  // Priority 2: Extract from Vite config
  const input = config.build?.rollupOptions?.input;

  if (input) {
    // Case: String input (e.g., 'index.html')
    if (typeof input === 'string') {
      ze_log.init(`Detected entrypoint from Vite config: ${input}`);
      return normalizeEntrypoint(input);
    }

    // Case: Object with multiple entries (e.g., { main: 'index.html', admin: 'admin.html' })
    if (typeof input === 'object' && !Array.isArray(input)) {
      const entries = Object.entries(input);

      if (entries.length > 0) {
        const [firstKey, firstValue] = entries[0];

        if (entries.length > 1) {
          ze_log.init(
            `Multiple entrypoints detected (${entries.length}). Using first: ${firstKey} -> ${firstValue}. ` +
              `To specify a different entrypoint, pass 'entrypoint' option to withZephyr().`
          );
        } else {
          ze_log.init(
            `Detected entrypoint from Vite config: ${firstKey} -> ${firstValue}`
          );
        }

        return normalizeEntrypoint(String(firstValue));
      }
    }

    // Case: Array input (rare, but possible)
    if (Array.isArray(input) && input.length > 0) {
      const firstEntry = input[0];

      if (input.length > 1) {
        ze_log.init(
          `Multiple entrypoints detected (${input.length}). Using first: ${firstEntry}. ` +
            `To specify a different entrypoint, pass 'entrypoint' option to withZephyr().`
        );
      } else {
        ze_log.init(`Detected entrypoint from Vite config: ${firstEntry}`);
      }

      return normalizeEntrypoint(String(firstEntry));
    }
  }

  // Priority 3: Default fallback
  ze_log.init('No entrypoint specified, using Vite default: index.html');
  return 'index.html';
}
