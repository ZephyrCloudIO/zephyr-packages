/**
 * Type augmentation for global variables Augments both global and globalThis with
 * specific properties
 */
declare global {
  // `var` is required here: `let`/`const` cannot augment the global/globalThis type.
  // eslint-disable-next-line no-var
  var NX_GRAPH_CREATION: boolean | undefined;
}

/**
 * Returns the global object (globalThis is the standard cross-environment global) The
 * returned object includes type-safe access to augmented properties
 */
export function getGlobal() {
  return globalThis;
}
