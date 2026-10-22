import { createApplicationUid } from 'zephyr-edge-contract';
import { getGitProviderInfo } from './git-provider-utils';
import { getPackageJson } from './ze-util-read-package-json';
import { runGit } from './ze-util-get-git-info';
import { hasZephyrConfigFile } from './zephyr-config';

export type PreflightApplicationUid =
  | { uid: string }
  | {
      uid?: undefined;
      /**
       * - `config-file`: a zephyr.config file may set the name, and reading it means
       *   running it.
       * - `unresolved`: the package name or the git remote origin is missing.
       */
      reason: 'config-file' | 'unresolved';
    };

/**
 * Works out the application UID that a build in `context` would use, from package.json
 * and the git remote origin only. It never contacts Zephyr and never runs project code,
 * so `doctor --online` can ask the API about the same application a build would.
 */
export async function resolvePreflightApplicationUid(
  context?: string
): Promise<PreflightApplicationUid> {
  if (hasZephyrConfigFile(context)) return { reason: 'config-file' };

  try {
    const remoteOrigin = await runGit(
      ['config', '--get', 'remote.origin.url'],
      context ?? process.cwd()
    );
    if (!remoteOrigin) return { reason: 'unresolved' };
    const { owner, project } = getGitProviderInfo(remoteOrigin);

    // An explicit empty config keeps this from loading a config file.
    const { name } = await getPackageJson(context, {});
    if (!name) return { reason: 'unresolved' };

    return { uid: createApplicationUid({ org: owner, project, name }) };
  } catch {
    return { reason: 'unresolved' };
  }
}
