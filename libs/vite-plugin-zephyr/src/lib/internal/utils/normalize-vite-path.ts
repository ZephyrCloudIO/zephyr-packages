/** Normalize emitted paths without importing Vite's ESM-only runtime. */
export function normalizeVitePath(pathname: string): string {
  return pathname.replace(/\\/g, '/');
}
