import { basename } from 'node:path';
import type { ZephyrEngineIdentity } from '../../zephyr-engine/zephyr-engine.types';
import { ZeErrors, ZephyrError } from '../errors';
import { isValidMcpSkillName, slugifyMcpName } from '../mcp/mcp-rules';
import type { ZePackageJson } from './ze-package-json.type';

export const ISOLATED_IDENTITY_VERSION = '0.0.0';

export interface ResolveIsolatedIdentityInput {
  identity: ZephyrEngineIdentity;
  /** `appName` from `<context>/zephyr.config.*`; wins when set. */
  appName?: string;
  /** Project name resolved from git (the repository name). */
  gitProject?: string;
  /** Context directory; its basename is the last fallback. */
  context: string;
}

/**
 * Resolve the application name of an isolated identity (contract section 1.1): `appName`
 * if set (it must already be a valid skill name), else the explicit name, else `slug(git
 * project)`, else `slug(basename(context))`.
 */
export function resolveIsolatedIdentityName({
  identity,
  appName,
  gitProject,
  context,
}: ResolveIsolatedIdentityInput): string {
  if (appName !== undefined) {
    if (!isValidMcpSkillName(appName)) {
      throw new ZephyrError(ZeErrors.ERR_ZEPHYR_CONFIG_NOT_VALID, {
        message:
          'appName must match ^[a-z0-9]+(-[a-z0-9]+)*$ (at most 64 characters, not "evals") for an isolated identity.',
      });
    }
    return appName;
  }

  if ('name' in identity) {
    if (!isValidMcpSkillName(identity.name)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: `Isolated identity name "${identity.name}" must match ^[a-z0-9]+(-[a-z0-9]+)*$ and be at most 64 characters.`,
      });
    }
    return identity.name;
  }

  const name =
    (gitProject ? slugifyMcpName(gitProject) : undefined) ??
    slugifyMcpName(basename(context));
  if (!name) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'Could not derive an application name from the git project or directory name. Set appName in zephyr.config.',
    });
  }
  return name;
}

/** Package properties for an isolated identity; never read from any package.json. */
export function createIsolatedPackageJson(name: string): ZePackageJson {
  return { name, version: ISOLATED_IDENTITY_VERSION };
}
