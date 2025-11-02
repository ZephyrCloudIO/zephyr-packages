/**
 * Vite-plugin-tanstack-start-zephyr
 *
 * Vite plugin for deploying TanStack Start applications to Zephyr with SSR support
 *
 * Configuration is automatically detected from:
 *
 * - Package.json (app name, version)
 * - Git info (org, project, branch)
 * - Zephyr auth (via `ze login`)
 */

export {
  withZephyrTanstackStart,
  type TanStackStartZephyrOptions,
} from './lib/vite-plugin-tanstack-start-zephyr';
