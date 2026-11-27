import type { DeniedEnvironment, UploadDeniedEnvironment } from 'zephyr-edge-contract';
import { ZeErrors } from '../errors/codes';
import { ZephyrError } from '../errors/zephyr-error';

/*
 * The output for a write a permission profile denied (ZephyrCloudIO/zephyr-cloud-io#4005):
 * an upload whose deploy was denied, or a 403 `ENVIRONMENT_DENIED` (a deploy or a
 * settings change). The bodies come from the network, so each value is checked here, one
 * entry at a time: a bad entry prints "details not available" and does not hide the
 * others. Contact names are never printed, because CI logs can be public, and printed
 * text has its control characters replaced, so a name cannot add lines to a CI log.
 */

type Reason = DeniedEnvironment['reason'];
type Role = DeniedEnvironment['requiredRole'];
type EnvironmentType = DeniedEnvironment['environment']['type'];

/** A denied environment the CLI can print: the contract entry without contact names. */
type DeniedEntry = UploadDeniedEnvironment;

/** An id and a display name: an environment, profile or tag. */
interface Ref {
  id: string;
  name: string;
}

/** What a denial lists: environments with details, and environments by name only. */
interface DeniedList {
  entries: DeniedEntry[];
  withoutDetails: Ref[];
}

const ROLE_LABELS: Record<Role, string> = {
  member: 'Member',
  maintainer: 'Maintainer',
};

/**
 * What the caller needs: the API's denial wording per reason. For a profile role the
 * profile has its own column, so the line ends at the role.
 */
const NEEDS: Record<Reason, (role: string) => string> = {
  no_seat: () => 'needs a seat; ask an org admin',
  no_grant: (role) => `needs the ${role} role`,
  maintainer_required: (role) => `needs the ${role} role`,
  no_app_edit_role: () => 'needs the app edit role; ask an org admin',
  org_admin_required: () => 'needs an org admin',
};

const ENVIRONMENT_TYPES: Record<EnvironmentType, true> = {
  production: true,
  staging: true,
  testing: true,
  development: true,
  other: true,
};

/**
 * A uuid-shaped id (8-4-4-4-12 hex), without a version or variant check: the id format of
 * the denied environments, profiles, tags and contacts in these bodies (ST-27
 * Identifiers). The API checks the stricter RFC 9562 form.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function isKeyOf<T extends object>(map: T, value: unknown): value is keyof T {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value);
}

/**
 * C0 and C1 control characters (including newline and escape), line and paragraph
 * separators, and bidirectional controls that can reorder a printed line.
 */
const CONTROL_CHARACTERS =
  // oxlint-disable-next-line no-control-regex
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]+/g;

/**
 * A non-empty string from the network, safe to print on one line of a CI log: control
 * characters are replaced, and workflow command markers are broken, so a name cannot run
 * a GitHub Actions command (`::` at the start of a trimmed line, `##[` anywhere).
 */
function printable(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/::/g, ': :')
    .replace(/##\[/g, '## [')
    .trim();
  return text || undefined;
}

/** The kept version's URL when it is an http(s) URL, unchanged; otherwise undefined. */
function readVersionUrl(value: string | undefined): string | undefined {
  if (!value || !URL.canParse(value)) return undefined;
  const { protocol } = new URL(value);
  return protocol === 'https:' || protocol === 'http:' ? value : undefined;
}

function readUuidRef(value: unknown): Ref | undefined {
  if (!isRecord(value) || !isUuid(value['id'])) return undefined;
  const name = printable(value['name']);
  return name ? { id: value['id'], name } : undefined;
}

/** A ref whose id can be any non-empty string. */
function readAnyRef(value: unknown): Ref | undefined {
  if (!isRecord(value) || typeof value['id'] !== 'string' || !value['id'])
    return undefined;
  const name = printable(value['name']);
  return name ? { id: value['id'], name } : undefined;
}

/**
 * The contact ids, and how many contacts were dropped for a bad id. Like the API, a bad
 * contact is counted, not shown, so it does not hide the entry.
 */
function readContacts(
  value: unknown
): { contacts: DeniedEntry['contacts']; dropped: number } | undefined {
  if (!Array.isArray(value)) return undefined;
  const contacts: DeniedEntry['contacts'] = [];
  for (const contact of value) {
    if (isRecord(contact) && isUuid(contact['id'])) contacts.push({ id: contact['id'] });
  }
  return { contacts, dropped: value.length - contacts.length };
}

/**
 * The entry when it matches the contract, without contact names; otherwise undefined. A
 * value outside the contract, such as a new reason, makes the entry print "details not
 * available" instead of a wrong fix. So does the API's minimal entry (no profile,
 * `no_grant`, no contacts): the API sends it when it could not read the details, so its
 * reason is a guess.
 */
function readEntry(value: unknown): DeniedEntry | undefined {
  if (!isRecord(value)) return undefined;
  const environment = readUuidRef(value['environment']);
  const type = isRecord(value['environment']) ? value['environment']['type'] : undefined;
  const profile = value['profile'] === null ? null : readUuidRef(value['profile']);
  const { requiredRole, reason, moreContacts } = value;
  const read = readContacts(value['contacts']);
  const viaTag = value['viaTag'] === undefined ? undefined : readUuidRef(value['viaTag']);
  if (
    !read ||
    (profile === null && reason === 'no_grant' && !read.contacts.length && !moreContacts)
  ) {
    return undefined;
  }
  if (
    !environment ||
    !isKeyOf(ENVIRONMENT_TYPES, type) ||
    profile === undefined ||
    !isKeyOf(ROLE_LABELS, requiredRole) ||
    !isKeyOf(NEEDS, reason) ||
    typeof moreContacts !== 'number' ||
    !Number.isInteger(moreContacts) ||
    moreContacts < 0 ||
    (value['viaTag'] !== undefined && !viaTag)
  ) {
    return undefined;
  }
  return {
    environment: { ...environment, type },
    profile,
    requiredRole,
    reason,
    contacts: read.contacts,
    moreContacts: moreContacts + read.dropped,
    ...(viaTag ? { viaTag } : {}),
  };
}

/** The denied environments of a list from the network, checked one entry at a time. */
function readDeniedList(value: unknown): DeniedList {
  const list: DeniedList = { entries: [], withoutDetails: [] };
  if (!Array.isArray(value)) return list;
  for (const item of value) {
    const entry = readEntry(item);
    if (entry) {
      list.entries.push(entry);
      continue;
    }
    const environment = isRecord(item) ? readUuidRef(item['environment']) : undefined;
    if (environment) list.withoutDetails.push(environment);
  }
  return list;
}

function deniedIds(list: DeniedList): string[] {
  return [...list.entries.map((entry) => entry.environment), ...list.withoutDetails].map(
    (env) => env.id
  );
}

/**
 * The environments `ignoredEnvs` lists as denied. Any non-empty id is accepted: the API
 * lists an environment with a non-uuid id here, and leaves it out of `outcome.denied`.
 * Malformed entries are skipped.
 */
function readDeniedIgnoredEnvs(value: unknown): Ref[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const ref = readAnyRef(item);
    return ref && isRecord(item) && item['reason'] === 'denied' ? [ref] : [];
  });
}

function environmentLine(entry: DeniedEntry): string {
  const via = entry.viaTag ? ` (follows tag "${entry.viaTag.name}")` : '';
  const profile = entry.profile ? `profile "${entry.profile.name}"` : 'profile unknown';
  const need = NEEDS[entry.reason](ROLE_LABELS[entry.requiredRole]);
  return `  ${entry.environment.name}${via}  ${profile}  ${need}`;
}

function contactLine(entries: DeniedEntry[]): string {
  // The contacts are the org's owners and admins: the same for every environment.
  const counts = entries.map((entry) => entry.contacts.length + entry.moreContacts);
  const total = Math.max(0, ...counts);
  if (!total) return '  contact: an org admin';
  return `  contact: an org admin (${total} in this org; see their names in Zephyr)`;
}

/** The optional lines under the heading of a denial block. */
interface DeniedHeader {
  /** The line that says what was refused. */
  summary?: string;
  /** The kept version's URL, so the user can still open it. */
  versionUrl?: string;
}

/**
 * The denial block: the heading, the kept version, a line per environment (from the
 * entries with details, then by name only), and whom to ask.
 */
function formatDeployDenied(
  heading: string,
  list: DeniedList,
  { summary, versionUrl }: DeniedHeader = {}
): string {
  const lines = [heading];
  if (summary) lines.push(`  ${summary}`);
  if (versionUrl) lines.push(`  version: ${versionUrl}`);
  lines.push(...list.entries.map(environmentLine));
  lines.push(...list.withoutDetails.map((env) => `  ${env.name}  details not available`));
  if (!list.entries.length && !list.withoutDetails.length && !summary) {
    lines.push('  details not available; see the application audit log in Zephyr');
  }
  lines.push(contactLine(list.entries));
  return lines.join('\n');
}

/**
 * True when the upload outcome says the deploy was denied. Only `result` decides:
 * `denied` can be incomplete.
 */
export function isDeniedOutcome(outcome: unknown): boolean {
  return isRecord(outcome) && outcome['result'] === 'denied';
}

/** The upload response members a denial is read from, as they came from the network. */
export interface DeniedUploadResponse {
  outcome: unknown;
  ignoredEnvs?: unknown;
}

/**
 * The build error for an upload whose deploy was denied: the version is kept, and none of
 * the app's tags or environments moved. The kept version's URL is printed and put on the
 * error data, because the engine does not log it for a failed upload. Every environment
 * `ignoredEnvs` lists as denied is named, with details where `outcome.denied` has them.
 */
export function deployDeniedError(
  app: { name: string; uid: string; versionUrl?: string },
  response: DeniedUploadResponse
): ZephyrError<'ERR_DEPLOY_DENIED'> {
  const outcome = isRecord(response.outcome) ? response.outcome : {};
  const list = readDeniedList(outcome['denied']);
  const listed = new Set(deniedIds(list));
  for (const env of readDeniedIgnoredEnvs(response.ignoredEnvs)) {
    if (!listed.has(env.id)) {
      list.withoutDetails.push(env);
      listed.add(env.id);
    }
  }
  const version = isRecord(outcome['version']) ? outcome['version']['id'] : undefined;
  const versionUrl = readVersionUrl(app.versionUrl);

  return new ZephyrError(ZeErrors.ERR_DEPLOY_DENIED, {
    message: formatDeployDenied(
      `Deploy denied for ${app.name} (version kept, nothing moved)`,
      list,
      { versionUrl: printable(versionUrl) }
    ),
    data: {
      applicationUid: app.uid,
      versionId: isUuid(version) ? version : undefined,
      versionUrl,
      deniedEnvironmentIds: [...listed],
    },
  });
}

/**
 * The error for a 403 body a permission profile refused, or undefined for any other body.
 * The refused write can be a deploy or a settings change, so the heading does not name
 * the action.
 *
 * TODO(ZephyrCloudIO/zephyr-cloud-io#4543): detect the denial by its Problem Details
 * `type` once the API defines it; `code` stays only for one contract version.
 */
export function environmentDeniedError(
  body: unknown
): ZephyrError<'ERR_DEPLOY_DENIED'> | undefined {
  if (!isRecord(body) || body['code'] !== 'ENVIRONMENT_DENIED') return undefined;
  const list = readDeniedList(body['environments']);
  return new ZephyrError(ZeErrors.ERR_DEPLOY_DENIED, {
    message: formatDeployDenied(
      'Denied by a permission profile (nothing changed)',
      list,
      { summary: deniedSummary(body, list) }
    ),
    data: { deniedEnvironmentIds: deniedIds(list) },
  });
}

/**
 * The line under the heading of a 403 denial: the Problem Details `title` and `detail`
 * (ST-25 Problem Details). The legacy `message` names the same environment as its line,
 * so it is printed only when no environment could be read.
 */
function deniedSummary(
  body: Record<string, unknown>,
  list: DeniedList
): string | undefined {
  const problem = [printable(body['title']), printable(body['detail'])].filter(Boolean);
  if (problem.length) return problem.join(': ');
  if (deniedIds(list).length) return undefined;
  return printable(body['message']);
}
