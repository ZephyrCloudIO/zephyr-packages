export function getPackageDependencies(
  dependencies: Record<string, string> | undefined
): Array<{ name: string; version: string }> {
  if (!dependencies) return [];
  return Object.entries(dependencies).map(([name, version]) => ({ name, version }));
}
