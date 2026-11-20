import type {
  DeniedEnvironment,
  EnvironmentDeniedResponse,
  PublishOutcome,
} from 'zephyr-edge-contract';
import { ZeErrors } from '../errors/codes';
import { ZephyrError } from '../errors/zephyr-error';

/** An environment the upload did not move, as the API lists it in `ignoredEnvs`. */
export interface IgnoredEnv {
  id: string;
  name: string;
  reason?: 'locked' | 'protected' | 'denied' | 'held';
}

const ROLE_LABELS: Record<DeniedEnvironment['requiredRole'], string> = {
  member: 'Member',
  maintainer: 'Maintainer',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for a 403 body refused for an environment's permission profile. */
export function isEnvironmentDeniedResponse(
  value: unknown
): value is EnvironmentDeniedResponse {
  return (
    isRecord(value) &&
    value['code'] === 'ENVIRONMENT_DENIED' &&
    Array.isArray(value['environments'])
  );
}

/** True when the upload outcome says the deploy was denied. */
export function isDeniedOutcome(value: unknown): value is PublishOutcome {
  return isRecord(value) && value['result'] === 'denied';
}

function environmentLine(denied: DeniedEnvironment): string {
  const name = denied.environment?.name ?? 'unknown environment';
  const via = denied.viaTag?.name ? ` (follows tag "${denied.viaTag.name}")` : '';
  const profile = denied.profile?.name
    ? `profile "${denied.profile.name}"`
    : 'no profile';
  const need =
    denied.reason === 'no_seat'
      ? 'needs a seat; ask an org admin'
      : `needs ${ROLE_LABELS[denied.requiredRole] ?? denied.requiredRole}`;
  return `  ${name}${via}  ${profile}  ${need}`;
}

function contactLine(denied: DeniedEnvironment[]): string {
  // The contacts are the org's owners and admins: the same for every environment.
  const first = denied.find((entry) => entry.contacts?.length || entry.moreContacts);
  if (!first) return '  contact: an org admin';
  const names = (first.contacts ?? []).map((contact) => contact.name);
  const more = first.moreContacts ?? 0;
  if (more > 0) {
    names.push(`and ${more} more org admin${more === 1 ? '' : 's'}`);
  }
  return `  contact: ${names.join(', ')}`;
}

/**
 * The denial block printed for an app. Every denied environment gets a line: from
 * `denied` with its profile and role, or by name only when its details were not
 * returned.
 */
export function formatDeployDenied(
  heading: string,
  denied: DeniedEnvironment[],
  missingNames: string[] = []
): string {
  const lines = [heading];
  lines.push(...denied.map(environmentLine));
  lines.push(...missingNames.map((name) => `  ${name}  details not available`));
  if (!denied.length && !missingNames.length) {
    lines.push('  details not available; see the application audit log in Zephyr');
  }
  lines.push(contactLine(denied));
  return lines.join('\n');
}

/**
 * The build error for an upload whose deploy was denied: the version is kept, and none of
 * the app's tags or environments moved.
 */
export function deployDeniedError(
  appName: string,
  outcome: PublishOutcome,
  ignoredEnvs: IgnoredEnv[] = []
): ZephyrError<'ERR_DEPLOY_DENIED'> {
  const denied = Array.isArray(outcome.denied) ? outcome.denied : [];
  const listed = new Set(denied.map((entry) => entry.environment?.id));
  // `outcome.denied` leaves out an environment the API could not read; ignoredEnvs names it.
  const missingNames = ignoredEnvs
    .filter((env) => env.reason === 'denied' && !listed.has(env.id))
    .map((env) => env.name);

  return new ZephyrError(ZeErrors.ERR_DEPLOY_DENIED, {
    message: formatDeployDenied(
      `Deploy denied for ${appName} (version kept, nothing moved)`,
      denied,
      missingNames
    ),
    data: { versionId: outcome.version?.id },
  });
}

/** The build error for a write the API refused with 403 `ENVIRONMENT_DENIED`. */
export function environmentDeniedError(
  response: EnvironmentDeniedResponse
): ZephyrError<'ERR_DEPLOY_DENIED'> {
  return new ZephyrError(ZeErrors.ERR_DEPLOY_DENIED, {
    message: formatDeployDenied(
      `Deploy denied (nothing moved)${response.message ? `: ${response.message}` : ''}`,
      response.environments
    ),
  });
}
