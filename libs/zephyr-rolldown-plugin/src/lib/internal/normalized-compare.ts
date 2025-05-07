/**
 * Helper function to normalize names for dependency matching Handles differences between
 * hyphens and underscores in names
 *
 * @param str1 First string to compare
 * @param str2 Second string to compare
 * @returns True if strings match after normalization
 */
export function normalizedCompare(str1: string, str2: string): boolean {
  if (str1 === str2) return true;

  // Normalize by replacing all hyphens with underscores
  const normalized1 = str1.replace(/-/g, '_');
  const normalized2 = str2.replace(/-/g, '_');

  return normalized1 === normalized2;
}
