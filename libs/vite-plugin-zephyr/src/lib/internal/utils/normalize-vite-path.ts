export function normalizeVitePath(pathname: string): string {
  return pathname.replace(/\\/g, '/');
}
