/**
 * A JSON-style object: not `null` and not an array. Dependency-free, so the isolate
 * bundle can share it.
 */
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
