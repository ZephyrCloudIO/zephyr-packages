import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ZephyrDependencies {
  [key: string]: string;
}

export function read_package_json(root: string): any {
  const packageJsonPath = join(root, 'package.json');
  const packageJsonContent = existsSync(packageJsonPath)
    ? readFileSync(packageJsonPath, 'utf-8')
    : '{}';
  const packageJson = JSON.parse(packageJsonContent);

  // Ensure zephyrDependencies exists for backward compatibility
  if (!packageJson.zephyrDependencies) {
    packageJson.zephyrDependencies = {};
  }

  return packageJson;
}
