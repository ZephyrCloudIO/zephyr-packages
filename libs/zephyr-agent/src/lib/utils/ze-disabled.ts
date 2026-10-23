import { logFn } from '../logging/ze-log-event';

/** The one line printed whenever `ZE_DISABLED=true` stops a Zephyr deployment. */
export const ZE_DISABLED_MESSAGE =
  'The bundle is built. The bundle is not deployed. Zephyr is disabled (ZE_DISABLED).';

/**
 * Skip mode: `ZE_DISABLED=true` makes the plugins and `ze-cli` skip every Zephyr step.
 *
 * It is always explicit. Nothing turns it on by itself, and it is not the fail-open
 * behavior after an outage: with skip mode on, Zephyr is never contacted at all.
 */
export function isZephyrDisabled(): boolean {
  return process.env['ZE_DISABLED'] === 'true';
}

/** Tells the user that the build finished but Zephyr did not deploy it. */
export function logZephyrDisabled(): void {
  logFn('warn', ZE_DISABLED_MESSAGE);
}

/** The Rollup-compatible hooks that skip mode needs. Rollup, Rolldown and Vite share them. */
export interface ZephyrDisabledBuildHooks {
  buildStart(): void;
  renderStart(): void;
  buildEnd(error?: unknown): void;
  renderError(): void;
  closeBundle(): void;
}

/**
 * Hooks for Rollup-style bundlers in skip mode (`ZE_DISABLED=true`). They only watch the
 * build: once a bundle closes without an error they say once that it was not deployed.
 */
export function createZephyrDisabledBuildHooks(): ZephyrDisabledBuildHooks {
  let announced = false;
  let failed = false;
  return {
    buildStart() {
      failed = false;
    },
    renderStart() {
      failed = false;
    },
    buildEnd(error) {
      failed = Boolean(error);
    },
    // Bundlers close the bundle even when rendering or writing it failed.
    renderError() {
      failed = true;
    },
    closeBundle() {
      if (announced || failed) return;
      announced = true;
      logZephyrDisabled();
    },
  };
}
