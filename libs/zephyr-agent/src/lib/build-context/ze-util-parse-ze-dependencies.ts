// this file should contain one function which will recieve a key and a value, both are strings
// key is the name of the dependency, value is the version/tag/env
// it should return a ZePackageJson
// value could be a semver version, or 'zephyr:remote_app_uid', or 'zephyr:remote_app_uid@latest', or 'zephyr:semver_version'

import { ZeDependency, ZePackageJson } from './ze-package-json.type';

export function parseZeDependencies(
  ze_dependencies: Record<string, string>
): ZePackageJson['zephyrDependencies'] {
  return Object.fromEntries(
    Object.entries(ze_dependencies).map(([key, value]) => [
      key,
      parseZeDependency(key, value),
    ])
  );
}

function parseZeDependency(key: string, value: string): ZeDependency {
  return {
    version: value,
    registry: 'zephyr',
    app_uid: key,
  };
}
