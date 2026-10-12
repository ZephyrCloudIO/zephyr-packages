import { type EvalResults, ZEPHYR_EVAL_RESULTS_FORMAT } from 'zephyr-edge-contract';
import { MCP_AGENT_KEYS, MCP_LIMITS, isCalendarDate, isPlainObject } from './mcp-rules';

export interface EvalResultsIssue {
  /** JSON path inside the eval results document. */
  path: string;
  message: string;
}

/**
 * ISO 8601 date-time with `Z` or a `±HH:MM` offset and optional seconds and fraction,
 * with every time field in range. The date part is checked against the calendar
 * separately, so `2026-02-30` fails like it does in the API.
 */
const ISO_8601_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
/** The API's `evalId` bound; checked here so an oversized id fails before any upload. */
const EVAL_ID_MAX_LENGTH = 256;
/** EvalResults is strict at every level (contract amendment 11.2). */
const ROOT_KEYS: ReadonlySet<string> = new Set([
  'format',
  'generatedAt',
  'runner',
  'agent',
  'results',
  'summary',
]);
const RESULT_KEYS: ReadonlySet<string> = new Set([
  'skill',
  'evalId',
  'passed',
  'runs',
  'passRate',
  'durationMs',
]);
const SUMMARY_KEYS: ReadonlySet<string> = new Set(['total', 'passed']);

/**
 * Validate `EvalResults` v1 (contract section 3.1 and amendment 11.2) against the skills
 * of the catalog the results are attached to. Strict like the API: an unknown key at the
 * root, in a result or in the summary is an issue at that key's path, so ze-cli fails
 * before any upload instead of the API rejecting the version afterwards.
 */
export function validateEvalResults(
  value: unknown,
  catalogSkills: ReadonlySet<string>
): { evalResults?: EvalResults; issues: EvalResultsIssue[] } {
  const issues: EvalResultsIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });

  if (!isPlainObject(value)) {
    issue('$', 'Eval results must be a JSON object.');
    return { issues };
  }
  const rejectUnknownKeys = (
    record: Record<string, unknown>,
    allowed: ReadonlySet<string>,
    prefix: string
  ) => {
    for (const key of Object.keys(record)) {
      if (!allowed.has(key)) issue(`${prefix}${boundKey(key)}`, 'Unknown key.');
    }
  };
  rejectUnknownKeys(value, ROOT_KEYS, '');
  if (value['format'] !== ZEPHYR_EVAL_RESULTS_FORMAT) {
    issue('format', `Must be "${ZEPHYR_EVAL_RESULTS_FORMAT}".`);
  }
  if (!isIsoDateTime(value['generatedAt'])) {
    issue('generatedAt', 'Must be an ISO 8601 date-time.');
  }
  const runner = value['runner'];
  if (
    runner !== undefined &&
    (typeof runner !== 'string' || runner.length > MCP_LIMITS.evalRunnerLength)
  ) {
    issue('runner', 'Must be a string of at most 128 characters.');
  }
  const agent = value['agent'];
  if (
    agent !== undefined &&
    (typeof agent !== 'string' || !MCP_AGENT_KEYS.includes(agent))
  ) {
    issue('agent', `Must be a canonical agent key: ${MCP_AGENT_KEYS.join(', ')}.`);
  }

  const results = value['results'];
  let passedCount = 0;
  if (!Array.isArray(results)) {
    issue('results', 'Must be an array.');
  } else {
    if (results.length > MCP_LIMITS.evalResults) {
      issue('results', `At most ${MCP_LIMITS.evalResults} results are allowed.`);
    }
    const seen = new Set<string>();
    results.forEach((result, index) => {
      const at = `results[${index}]`;
      if (!isPlainObject(result)) {
        issue(at, 'Must be an object.');
        return;
      }
      rejectUnknownKeys(result, RESULT_KEYS, `${at}.`);
      const { skill, evalId, passed, runs, passRate, durationMs } = result;
      if (typeof skill !== 'string' || !catalogSkills.has(skill)) {
        issue(`${at}.skill`, 'Must name a skill in the catalog.');
      }
      if (
        typeof evalId !== 'string' ||
        evalId.length === 0 ||
        evalId.length > EVAL_ID_MAX_LENGTH
      ) {
        issue(`${at}.evalId`, 'Must be a non-empty string of at most 256 characters.');
      }
      if (typeof skill === 'string' && typeof evalId === 'string') {
        const key = JSON.stringify([skill, evalId]);
        if (seen.has(key)) issue(at, 'Duplicate (skill, evalId) pair.');
        seen.add(key);
      }
      if (typeof passed !== 'boolean') {
        issue(`${at}.passed`, 'Must be a boolean.');
      } else if (passed) {
        passedCount += 1;
      }
      if (runs !== undefined && !(Number.isSafeInteger(runs) && (runs as number) >= 1)) {
        issue(`${at}.runs`, 'Must be an integer of at least 1.');
      }
      if (
        passRate !== undefined &&
        !(typeof passRate === 'number' && passRate >= 0 && passRate <= 1)
      ) {
        issue(`${at}.passRate`, 'Must be a number from 0 to 1.');
      }
      if (
        durationMs !== undefined &&
        !(
          typeof durationMs === 'number' &&
          Number.isFinite(durationMs) &&
          durationMs >= 0
        )
      ) {
        issue(`${at}.durationMs`, 'Must be a finite number of at least 0.');
      }
    });
  }

  const summary = value['summary'];
  if (!isPlainObject(summary)) {
    issue('summary', 'Must be an object with total and passed.');
  } else {
    rejectUnknownKeys(summary, SUMMARY_KEYS, 'summary.');
    if (Array.isArray(results) && summary['total'] !== results.length) {
      issue('summary.total', 'Must equal the number of results.');
    }
    if (Array.isArray(results) && summary['passed'] !== passedCount) {
      issue('summary.passed', 'Must equal the number of passed results.');
    }
  }

  return issues.length
    ? { issues }
    : { evalResults: value as unknown as EvalResults, issues };
}

export function formatEvalResultsIssues(
  issues: readonly EvalResultsIssue[],
  limit = 20
): string {
  const lines = issues
    .slice(0, limit)
    .map(({ path, message }) => `- ${path}: ${message}`);
  if (issues.length > limit) lines.push(`- ...and ${issues.length - limit} more`);
  return lines.join('\n');
}

function isIsoDateTime(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const date = ISO_8601_PATTERN.exec(value)?.[1];
  return date !== undefined && isCalendarDate(date);
}

/** Keys are user input: keep them printable and bounded in an issue path. */
function boundKey(key: string): string {
  const printable = key.replace(/[^\w.$-]/g, '_');
  return printable.length <= 64 ? printable : `${printable.slice(0, 61)}...`;
}
