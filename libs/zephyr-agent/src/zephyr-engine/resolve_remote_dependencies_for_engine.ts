import { ZeUtils, createApplicationUid } from 'zephyr-edge-contract';
import { ze_log } from '../lib/logging';
import type { ZeDependencyPair } from './is_zephyr_dependency_pair';
import { is_zephyr_resolved_dependency } from './is_zephyr_resolved_dependency';
import {
  type ZeResolvedDependency,
  resolve_remote_dependency,
} from './resolve_remote_dependency';
import type { Platform } from './create_zephyr_engine';

export interface ResolveRemoteDependenciesContext {
  npmProperties: {
    zephyrDependencies?: { [key: string]: { app_uid?: string; version?: string } };
  };
  env: { target: Platform };
  gitProperties: {
    app: { org: string; project: string };
  };
}

export async function resolve_remote_dependencies_for_engine(
  deps: ZeDependencyPair[],
  context: ResolveRemoteDependenciesContext
): Promise<ZeResolvedDependency[] | null> {
  const ze_dependencies = context.npmProperties.zephyrDependencies;
  const platform = context.env.target;

  if (!deps) {
    return null;
  }

  ze_log(
    'resolve_remote_dependencies.deps',
    deps,
    'platform',
    platform,
    'ze_dependencies',
    ze_dependencies
  );

  const tasks = deps.map(async (dep) => {
    const [app_name, project_name, org_name] = dep.name.split('.', 3);
    const ze_dependency = ze_dependencies?.[dep.name];
    const [ze_app_name, ze_project_name, ze_org_name] =
      ze_dependency?.app_uid?.split('.') ?? [];

    const dep_application_uid = createApplicationUid({
      org: ze_org_name ?? org_name ?? context.gitProperties.app.org,
      project: ze_project_name ?? project_name ?? context.gitProperties.app.project,
      name: ze_app_name ?? app_name,
    });

    const tuple = await ZeUtils.PromiseTuple(
      resolve_remote_dependency({
        application_uid: dep_application_uid,
        version: ze_dependency?.version ?? dep.version,
        platform,
      })
    );

    if (!ZeUtils.isSuccessTuple(tuple)) {
      ze_log(
        `Failed to resolve remote dependency: ${dep.name}@${dep.version}`,
        'skipping...'
      );
      return null;
    }

    ze_log(`Resolved dependency: ${tuple[1].default_url}`);

    if (dep.name === tuple[1].name) {
      return tuple[1];
    }

    return Object.assign({}, tuple[1], { name: dep.name, version: dep.version });
  });

  const resolution_results = await Promise.all(tasks);

  return resolution_results.filter(is_zephyr_resolved_dependency);
}
