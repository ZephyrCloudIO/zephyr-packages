import { join, sep } from 'node:path';
import { readFileSync } from 'node:fs';
import { getLicenses } from './get-licenses';
// import { StatsModule } from 'webpack';
import type { NpmModules } from './convert-dependencies';
import type { ModuleObject } from './module-part-two';
import type { LocalPackageJson } from 'zephyr-edge-contract';
import type { XStatsModule } from '../../../xpack.types';

export interface Consume {
  consumingApplicationID: string;
  applicationID: string | null;
  name: string;
  usedIn: Set<string>;
}

interface ModulePartOneReturn {
  consumes: Consume[];
  modulesObj: Record<string, ModuleObject>;
  npmModules: NpmModules;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * TODO: needs full rewrite Module analyzes the build statistics from Rspack to identify
 * three key aspects of Module Federation. It calculate remote-module, container entry and
 * node_modules
 *
 * 1. Remote Modules (remote-module) // TODO: this is broken needs to fix Tracks which
 *    modules are being consumed from other federated applications Maps the relationships
 *    between consuming applications and their remote dependencies Records where these
 *    remote modules are being used within the application
 * 2. Container Entry (container entry) Processes the entry points exposed by the Module
 *    Federation container Creates a mapping of exposed modules and their file locations
 * 3. Node Modules (node_modules) Collects information about third-party dependencies Gathers
 *    metadata like package versions, licenses, and sizes Helps track shared dependencies
 *    between federated applications
 *
 * @param modules - The stats object from @rspack/core to parse.
 * @returns An object containing the consumes, modulesObj, and npmModules.
 */

export function modulePartOne(modules: XStatsModule[] | undefined): ModulePartOneReturn {
  const consumes: Consume[] = [];
  const consumesByName: Record<string, Consume> = {};
  const modulesObj: Record<
    string,
    {
      id: string;
      name: string;
      applicationID: string;
      requires: string[];
      file: string;
    }
  > = {};
  const npmModules = new Map<string, Record<string, LocalPackageJson>>();

  modules?.forEach((mod) => {
    const { identifier, reasons, moduleType, nameForCondition, size } = mod;
    console.log(
      `modulePartOne.mod: identifier: ${identifier}, reasons: ${reasons}, moduleType: ${moduleType}, nameForCondition: ${nameForCondition}, size: ${size}`
    );
    const data = identifier?.split(' ') as (string | undefined)[] | undefined;

    if (moduleType === 'remote-module') {
      if (data?.length === 4 && isString(data[3]) && isString(data[2])) {
        console.log('data', data);
        console.log('data[3]', data[3]);
        const name = data[3].replace('./', '');

        let applicationID: string | null = data[2].replace(
          'webpack/container/reference/',
          ''
        );

        if (applicationID.includes('?')) {
          applicationID = new URLSearchParams(applicationID.split('?')[1]).get(
            'remoteName'
          );
        }

        const consume = {
          consumingApplicationID: name,
          applicationID,
          name,
          usedIn: new Set<string>(),
        };

        consumes.push(consume);
        if (nameForCondition) {
          consumesByName[nameForCondition] = consume;
        }
      }

      if (reasons) {
        console.log(`modulePartOne.reasons: reasons: ${reasons}`);
        reasons.forEach(({ userRequest, resolvedModule }) => {
          console.log(
            `modulePartOne.reasons: userRequest: ${userRequest}, resolvedModule: ${resolvedModule}`
          );
          if (!userRequest || !consumesByName[userRequest] || !resolvedModule) return;
          const module = resolvedModule.replace('./', '');
          consumesByName[userRequest].usedIn.add(module);
        });
      }
    } else if (data && data[0] === 'container' && data[1] === 'entry' && data[3]) {
      JSON.parse(data[3]).forEach(
        ([prefixedName, file]: [
          string,
          {
            import: string[];
          },
        ]) => {
          const name = prefixedName.replace('./', '');
          modulesObj[file.import[0]] = {
            id: `${name}:${name}`,
            name,
            applicationID: name,
            requires: [],
            file: file.import[0],
          };
        }
      );
    } else if (nameForCondition && nameForCondition.includes('node_modules')) {
      const contextArray = nameForCondition.split(sep);
      const afterModule = nameForCondition.split('node_modules' + sep);

      const search = afterModule[1] && afterModule[1].startsWith('@') ? 3 : 2;
      contextArray.splice(contextArray.indexOf('node_modules') + search);

      const context = contextArray.join(sep);

      const packageJsonFile = join(context, 'package.json');
      const packageJson = safe_read_package_json_sync(packageJsonFile);

      if (packageJson) {
        const existingPackage = npmModules.get(packageJson.name);
        if (existingPackage) {
          const existingReference = existingPackage[packageJson.version];
          const data = {
            name: packageJson.name,
            version: packageJson.version,
            homepage: packageJson.homepage,
            license: getLicenses(packageJson),
            size: (Number(existingReference.size) || 0) + (size ?? 0),
          };
          if (existingReference) {
            Object.assign(existingReference, data);
          } else {
            existingPackage[packageJson.version] = data;
          }
          npmModules.set(packageJson.name, existingPackage);
        } else {
          const newDep = {
            [packageJson.version]: {
              name: packageJson.name,
              version: packageJson.version,
              homepage: packageJson.homepage,
              license: getLicenses(packageJson),
              size,
            },
          };
          npmModules.set(packageJson.name, newDep);
        }
      }
    }
  });

  return { consumes, modulesObj, npmModules };
}

function safe_read_package_json_sync(file_path: string): LocalPackageJson | undefined {
  try {
    return JSON.parse(readFileSync(file_path, { encoding: 'utf-8' })) as LocalPackageJson;
  } catch {
    return;
  }
}
