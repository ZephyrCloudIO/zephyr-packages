import type { PartialAssetMapScope, ZephyrBuildTarget } from 'zephyr-agent';
import { ZeErrors, ZephyrError } from 'zephyr-agent';

export interface VitePartialBuildOptions {
  /** Artifact family for this independent producer process. */
  target?: ZephyrBuildTarget;
  /** Shared by every producer and finalizer process for one logical build. */
  invocationId?: string;
  /** Rebuild generation within the invocation (default: 0). */
  generation?: number;
}

function firstDefined(parts: readonly (string | undefined)[]): string | undefined {
  return parts.every((part) => !!part) ? parts.join(':') : undefined;
}

function resolveCiInvocationId(env: NodeJS.ProcessEnv): string | undefined {
  return (
    firstDefined([
      env['GITHUB_RUN_ID'],
      env['GITHUB_RUN_ATTEMPT'] ?? '1',
      env['GITHUB_JOB'],
    ]) ??
    firstDefined([env['CI_PIPELINE_ID'], env['CI_JOB_ID']]) ??
    firstDefined([env['BUILDKITE_BUILD_ID'], env['BUILDKITE_JOB_ID']]) ??
    firstDefined([env['CIRCLE_WORKFLOW_ID'], env['CIRCLE_BUILD_NUM']])
  );
}

export function resolveVitePartialBuildScope(
  options: VitePartialBuildOptions | undefined,
  env: NodeJS.ProcessEnv = process.env
): PartialAssetMapScope | undefined {
  const invocationId =
    options?.invocationId?.trim() ||
    env['ZE_BUILD_INVOCATION_ID']?.trim() ||
    resolveCiInvocationId(env);
  if (!invocationId) return undefined;

  const generation = options?.generation ?? 0;
  if (!Number.isSafeInteger(generation) || generation < 0) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: 'Vite partial build generation must be a non-negative safe integer.',
    });
  }
  return { invocationId, generation };
}

export function requireVitePartialBuildScope(
  options: VitePartialBuildOptions | undefined
): PartialAssetMapScope {
  const scope = resolveVitePartialBuildScope(options);
  if (scope) return scope;
  throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
    message:
      'withZephyrPartial() requires a shared invocationId (or ZE_BUILD_INVOCATION_ID) ' +
      'so concurrent builds of the same application cannot mix outputs.',
  });
}
