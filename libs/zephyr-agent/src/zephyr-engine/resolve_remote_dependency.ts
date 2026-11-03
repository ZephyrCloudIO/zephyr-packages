import axios from 'axios';
import { isCI } from 'ci-info';
import {
  assertZephyrBuildTarget,
  ZE_API_ENDPOINT,
  ze_api_gateway,
  type ZephyrBuildTarget,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../lib/errors';
import type { ZephyrDependencyUrlMode } from '../lib/build-context/zephyr-config';
import { parseUrl } from '../lib/http/http-request';
import { ze_log } from '../lib/logging';
import { getToken } from '../lib/node-persist/token';
export interface ZeResolvedDependency {
  name: string;
  version: string;

  application_uid: string;
  default_url: string;
  remote_entry_url: string;
  manifest_url?: string;
  library_type: string;
  /** Build target this dependency was requested for. */
  platform?: ZephyrBuildTarget;
  /** What the selector matched; absent from older resolver APIs. */
  entity_type?: 'version' | 'tag' | 'environment';
  /** Tag or environment name for label matches; absent from older resolver APIs. */
  entity_name?: string | null;
  /** Platform of the matched version (`web` on a mobile fallback); absent from older APIs. */
  resolved_platform?: string | null;
}

/** Base64 build context the resolver matches `workspace:*` and environments against. */
export async function create_dependency_build_context(
  engine: {
    application_configuration: Promise<{ username: string }>;
    gitProperties: { git: { branch: string } };
    env: { env?: string | null };
  },
  target: ZephyrBuildTarget
): Promise<string> {
  const app_config = await engine.application_configuration;
  if (engine.env.env) {
    ze_log.config('Using environment:', engine.env.env);
  }
  const build_context_json = {
    target,
    isCI,
    branch: engine.gitProperties.git.branch,
    username: app_config.username,
    env: engine.env.env,
  };
  return Buffer.from(JSON.stringify(build_context_json)).toString('base64');
}

export async function resolve_remote_dependency(params: {
  application_uid: string;
  version: string;
  platform?: ZephyrBuildTarget;
  build_context: string;
  dependencyUrlMode?: ZephyrDependencyUrlMode;
}): Promise<ZeResolvedDependency> {
  if (params.platform !== undefined) {
    assertZephyrBuildTarget(params.platform, 'resolve_remote_dependency({ platform })');
  }
  try {
    return await request_remote_dependency(params);
  } catch (cause) {
    // Workspace protocol fallback: `workspace:*` resolves against the current build
    // context (the remote built on the same branch/user/CI). When no matching build
    // exists - e.g. building the host on its own without first building the remote -
    // fall back to the latest published version (`*`) instead of failing the remote,
    // so the host can still federate against a previously published remote. When a
    // workspace build does exist it wins, so this never weakens branch-aware resolution.
    if (params.version.startsWith('workspace:')) {
      ze_log.remotes(
        `No workspace build found for ${params.application_uid}@${params.version}; ` +
          'falling back to the latest published version'
      );
      return request_remote_dependency({ ...params, version: '*' });
    }

    throw cause;
  }
}

async function request_remote_dependency({
  application_uid,
  version,
  platform,
  build_context,
  dependencyUrlMode,
}: {
  application_uid: string;
  version: string;
  platform?: ZephyrBuildTarget;
  build_context: string;
  dependencyUrlMode?: ZephyrDependencyUrlMode;
}): Promise<ZeResolvedDependency> {
  const depUrl =
    ZE_API_ENDPOINT() +
    `${ze_api_gateway.resolve}/` +
    `${encodeURIComponent(application_uid)}/` +
    `${encodeURIComponent(version)}`;
  const resolveDependency = parseUrl(depUrl);

  if (platform) {
    resolveDependency.searchParams.append('build_target', platform);
  }

  if (build_context) {
    resolveDependency.searchParams.append('build_context', build_context);
  }

  if (dependencyUrlMode) {
    resolveDependency.searchParams.append('url_mode', dependencyUrlMode);
  }

  try {
    ze_log.remotes('URL for resolving dependency:', resolveDependency.toString());

    const token = await getToken();
    const res = await axios.get(resolveDependency.toString(), {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    // used only for error logging
    const [appName, projectName, orgName] = application_uid.split('.');

    // Check response status
    if (res.status < 200 || res.status >= 300) {
      throw new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
        appUid: application_uid,
        appName,
        projectName,
        orgName,
        version,
        data: {
          url: resolveDependency.toString(),
          error: res.data,
        },
      });
    }

    const response = res.data;

    if (response.value) {
      ze_log.remotes(
        'resolved dependency:',
        response.value,
        'application_uid: ',
        application_uid,
        'version: ',
        version
      );
      return Object.assign({}, response.value, {
        version,
        platform,
        resolved_platform: response.value.platform,
      });
    }

    throw new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
      appUid: application_uid,
      appName,
      projectName,
      orgName,
      version,
      data: { response },
    });
  } catch (cause) {
    if (cause instanceof ZephyrError) throw cause;

    throw new ZephyrError(ZeErrors.ERR_CANNOT_RESOLVE_APP_NAME_WITH_VERSION, {
      version,
      cause,
    });
  }
}
