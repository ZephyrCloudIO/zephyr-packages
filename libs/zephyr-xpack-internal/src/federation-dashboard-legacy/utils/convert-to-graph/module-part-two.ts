import { ConvertedDependencies } from './convert-dependencies';
import { XStatsModule } from '../../../xpack.types';

export interface ModuleObject {
  id: string;
  name: string;
  applicationID: string;
  requires: string[];
  file: string;
}

interface ModulePartTwoParams {
  readonly name: string | undefined;
  readonly modules: XStatsModule[] | undefined;
  readonly modulesObj: Record<string, ModuleObject>;
  readonly convertedDeps: ConvertedDependencies;
}

export interface Overrides {
  id: string;
  name: string;
  version: string;
  location: string;
  applicationID: string;
  // [key: string]: Overrides[keyof Overrides]
}

interface ModulePartTwoReturn {
  overrides: Record<string, unknown>;
}

/**
 * TODO: needs full rewrite Analyzing shared dependencies and module overrides
 *
 * 1. Shared Module Analysis
 *
 * - Processes provide-module types (modules that are shared with other applications) //
 *   TODO: this is wrong and doesn't apply to Rspack - need to fix
 * - Handles consume-shared-module types (modules that are consumed from the shared scope)
 *   // TODO: this is wrong and doesn't apply to Rspack
 *
 *   - Need to fix
 * - Builds dependency graphs between modules
 *
 * 2. Version Management
 *
 * - Tracks specific versions of shared dependencies
 * - Handles version resolution for shared modules Creates override configurations for
 *   specific package versions
 *
 * @param name: Name of the federated app
 * @param modules: Modules from the build stats
 * @param modulesObj: Processed module objects
 * @param convertedDeps: Converted dependencies
 * @returns Overrides: Record<string, unknown>
 */

export function modulePartTwo(params: ModulePartTwoParams): ModulePartTwoReturn {
  const { name, modules, modulesObj, convertedDeps } = params;
  const overrides = {} as Record<string, Overrides>;

  modules?.forEach((mod) => {
    const { identifier, issuerName, reasons, moduleType } = mod;

    let data = identifier?.split(' ');
    if (moduleType === 'provide-module' && data) {
      if (issuerName) {
        // This is a hack
        const issuerNameMinusExtension = issuerName.replace('.js', '');
        if (
          modulesObj[issuerNameMinusExtension] &&
          modulesObj[issuerNameMinusExtension].requires.indexOf(data[2]) === -1
        ) {
          modulesObj[issuerNameMinusExtension].requires.push(data[2]);
        }
      }
      if (reasons) {
        reasons.forEach(({ module }) => {
          // filters out entrypoints
          if (module) {
            const moduleMinusExtension = module.replace('.js', '');
            if (
              modulesObj[moduleMinusExtension] &&
              data &&
              modulesObj[moduleMinusExtension].requires.indexOf(data[2]) === -1
            ) {
              modulesObj[moduleMinusExtension].requires.push(data[2]);
            }
          }
        });
      }
      let name: string | undefined;
      let version: string | undefined;
      if (data[3].startsWith('@')) {
        const splitInfo = data[3].split('@');
        splitInfo[0] = '@';
        name = splitInfo[0] + splitInfo[1];
        version = splitInfo[2];
      } else if (data[3].includes('@')) {
        [name, version] = data[3].split('@');
      } else {
        [
          convertedDeps.dependencies,
          convertedDeps.devDependencies,
          convertedDeps.optionalDependencies,
        ].forEach((deps) => {
          if (!deps) return;
          const dep = deps.find(({ name }) => data && name === data[2]);

          if (!dep) return;
          version = dep.version;
        });
      }

      if (name && version) {
        overrides[name] = {
          id: name,
          name,
          version,
          location: name,
          applicationID: name,
        };
      }
    }

    if (moduleType !== 'consume-shared-module') {
      return;
    }

    data = identifier?.split('|');
    if (issuerName && data) {
      // This is a hack
      const issuerNameMinusExtension = issuerName.replace('.js', '');
      if (
        modulesObj[issuerNameMinusExtension] &&
        modulesObj[issuerNameMinusExtension].requires.indexOf(data[2]) === -1
      ) {
        modulesObj[issuerNameMinusExtension].requires.push(data[2]);
      }
    }

    if (reasons) {
      reasons.forEach(({ module }) => {
        // filters out entrypoints
        if (module) {
          const moduleMinusExtension = module.replace('.js', '');
          if (
            modulesObj[moduleMinusExtension] &&
            data &&
            modulesObj[moduleMinusExtension].requires.indexOf(data[2]) === -1
          ) {
            modulesObj[moduleMinusExtension].requires.push(data[2]);
          }
        }
      });
    }
    let version = '';

    if (data && data[3] && data[3]?.startsWith('=')) {
      version = data[3].replace('=', '');
    } else {
      [
        convertedDeps.dependencies,
        convertedDeps.devDependencies,
        convertedDeps.optionalDependencies,
      ].forEach((deps) => {
        if (!deps) return;
        const dep = deps.find(({ name }) => data && name === data[2]);

        if (!dep) return;
        version = dep.version;
      });
    }

    if (data && name) {
      overrides[data[2]] = {
        id: data[2],
        name: data[2],
        version,
        location: data[2],
        applicationID: name,
      };
    }
  });

  return { overrides };
}
