/**
 * Normalizes entrypoint paths to be relative and posix-style.
 *
 * - Converts Windows backslashes to forward slashes
 * - Removes leading './', '/', and 'dist/' prefixes
 *
 * @param entrypoint - The raw entrypoint path
 * @returns Normalized entrypoint path relative to build output
 */
export function normalizeEntrypoint(entrypoint: string): string {
  let normalized = entrypoint.trim();

  // Normalize path separators to forward slashes (web/posix style)
  normalized = normalized.split('\\').join('/');

  // Remove leading './'
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  // Remove leading '/'
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  // Remove 'dist/' prefix if present
  if (normalized.startsWith('dist/')) {
    normalized = normalized.slice('dist/'.length);
  }

  return normalized;
}
