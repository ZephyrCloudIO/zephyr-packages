import type { LocalPackageJson } from 'zephyr-edge-contract';

export function getLicenses(packageJson: LocalPackageJson): string | undefined {
  if (Array.isArray(packageJson.licenses)) {
    return packageJson.licenses
      .map((license: { type: string }) => license.type)
      .join(', ');
  }

  if (typeof packageJson.licenses !== 'string' && packageJson.licenses?.type) {
    return packageJson.licenses.type;
  }

  if (typeof packageJson.license !== 'string' && packageJson.license?.type) {
    return packageJson.license.type;
  }

  if (typeof packageJson.licenses === 'string') {
    return packageJson.licenses;
  }

  if (typeof packageJson.license === 'string') {
    return packageJson.license;
  }

  return;
}
