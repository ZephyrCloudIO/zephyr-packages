import { ConvertedDependencies } from '../convert-to-graph/convert-dependencies';
import { ModuleObject, Overrides } from '../convert-to-graph/module-part-two';
import { LocalPackageJson } from 'zephyr-edge-contract';

function mergeWithoutDupe(source: LocalPackageJson[]): LocalPackageJson[] {
  return source.reduce((acc, item) => {
    if (typeof item === 'object') {
      const isDupe = acc.find((existing) => {
        return Object.entries(existing).every(([key, value]) => {
          return item[key] === value;
        });
      });
      if (!isDupe) {
        acc.push(item);
      }
    } else {
      acc.push(item);
    }
    return acc;
  }, [] as LocalPackageJson[]);
}

type Graph = ConvertedDependencies & {
  id: string;
  name: string;
  remote: string;
  modules: ModuleObject[];
  overrides: Overrides[];
  consumes: {
    consumingApplicationID: string;
    applicationID: string | null;
    name: string;
    usedIn: {
      file: string;
      url: string;
    }[];
  }[];
};

export function mergeGraphs(graph1: Graph, graph2: Graph): Graph {
  graph1.devDependencies = mergeWithoutDupe([
    ...(graph2.devDependencies ?? []),
    ...(graph1.devDependencies ?? []),
  ]);
  graph1.dependencies = mergeWithoutDupe([
    ...(graph2.dependencies ?? []),
    ...(graph1.dependencies ?? []),
  ]);
  //exposed
  graph2.modules.forEach((hostModules) => {
    const existing = graph1.modules.find((sidecarModules) => {
      return (
        hostModules.id === sidecarModules.id &&
        hostModules.name === sidecarModules.name &&
        hostModules.file === sidecarModules.file &&
        hostModules.applicationID === sidecarModules.applicationID
      );
    });
    if (existing) {
      existing.requires = Array.from(
        new Set([...existing.requires, ...hostModules.requires])
      );
    } else {
      graph1.modules.push(hostModules);
    }
  });
  //shares
  graph2.overrides.forEach((hostOverrides) => {
    const existing = graph1.overrides.find((sidecarOverrides) => {
      return (
        sidecarOverrides.id === hostOverrides.id &&
        sidecarOverrides.name === hostOverrides.name &&
        sidecarOverrides.version === hostOverrides.version &&
        sidecarOverrides.location === hostOverrides.location &&
        sidecarOverrides.applicationID === hostOverrides.applicationID
      );
    });
    if (!existing) {
      graph1.overrides.push(hostOverrides);
    }
  });
  //consumes
  graph2.consumes.forEach((hostConsumedModule) => {
    const existing = graph1.consumes.find((sidecarConsumedModule) => {
      return (
        sidecarConsumedModule.consumingApplicationID ===
          hostConsumedModule.consumingApplicationID &&
        sidecarConsumedModule.applicationID ===
          hostConsumedModule.applicationID &&
        sidecarConsumedModule.name === hostConsumedModule.name
      );
    });

    if (existing) {
      hostConsumedModule.usedIn.forEach((consumedModule) => {
        const alreadyExists = existing.usedIn.find(({ file, url }) => {
          return consumedModule.file === file && consumedModule.url === url;
        });
        if (!alreadyExists) {
          existing.usedIn.push(consumedModule);
        }
      });
    } else {
      graph1.consumes.push(hostConsumedModule);
    }
  });

  return graph1;
}
