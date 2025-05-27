import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ZephyrDependencies {
  [key: string]: string;
}

export interface PackageJson {
  zephyrDependencies: ZephyrDependencies;
  [key: string]: any; // Allow additional properties for flexibility
}

export function read_package_json(root: string): PackageJson {
  const packageJsonPath = join(root, 'package.json');
  const packageJsonContent = existsSync(packageJsonPath)
    ? readFileSync(packageJsonPath, 'utf-8')
    : '{}';
  const packageJson: PackageJson = JSON.parse(packageJsonContent);

  // Ensure zephyrDependencies exists for backward compatibility
  if (!packageJson.zephyrDependencies) {
    packageJson.zephyrDependencies = {};
  }

  return packageJson;
}
