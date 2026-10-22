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
