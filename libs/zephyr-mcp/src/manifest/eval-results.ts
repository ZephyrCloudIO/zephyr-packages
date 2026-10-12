import * as z from 'zod';
import {
  ManifestError,
  maxLength,
  type CatalogManifest,
  toJson,
  type ManifestIssue,
} from './catalog';
import { AGENT_KEYS, LIMITS, type AgentKey } from './constants';

/** One eval run result for one skill. */
export interface EvalResult {
  skill: string;
  /** 1 to 256 characters. */
  evalId: string;
  passed: boolean;
  /** At least 1. */
  runs?: number;
  /** Between 0 and 1. */
  passRate?: number;
  /** Finite, at least 0. */
  durationMs?: number;
}

/** `zephyr-evals/v1`: what CI reports for a version, stored with it. */
export interface EvalResults {
  format: 'zephyr-evals/v1';
  /** ISO 8601 date-time with an offset; seconds are optional. */
  generatedAt: string;
  /** At most 128 characters. */
  runner?: string;
  /** A canonical agent key. */
  agent?: AgentKey;
  results: EvalResult[];
  summary: { total: number; passed: number };
}

/**
 * ISO 8601 date-time with a `Z` or `±hh:mm` offset; seconds and fractions are optional,
 * as zephyr-agent accepts. Impossible calendar dates are rejected.
 */
const DATE_TIME = z.union([
  z.iso.datetime({ offset: true }),
  z.iso.datetime({ offset: true, precision: -1 }),
]);

/**
 * The JSON shape of eval results; cross-field rules are in {@link parseEvalResults}.
 * Strict at every level: an unknown key is rejected, never dropped.
 */
export const EvalResultsSchema = z.strictObject({
  format: z.literal('zephyr-evals/v1'),
  generatedAt: DATE_TIME,
  runner: z
    .string()
    .refine(
      maxLength(LIMITS.evalRunner),
      `must be at most ${LIMITS.evalRunner} characters`
    )
    .optional(),
  agent: z.enum(AGENT_KEYS).optional(),
  results: z
    .array(
      z.strictObject({
        skill: z.string().min(1),
        // Lengths are UTF-16 code units (contract 12.5).
        evalId: z
          .string()
          .refine(
            (value) => value.length >= 1 && maxLength(LIMITS.evalId)(value),
            `must be 1-${LIMITS.evalId} characters`
          ),
        passed: z.boolean(),
        runs: z.int().min(1).optional(),
        passRate: z.number().min(0).max(1).optional(),
        // z.number() already rejects Infinity and NaN.
        durationMs: z.number().nonnegative().optional(),
      })
    )
    .max(LIMITS.evalResults),
  summary: z.strictObject({
    total: z.int().nonnegative(),
    passed: z.int().nonnegative(),
  }),
});

/**
 * Parse and validate eval results: the shape, then `summary` against `results`, unique
 * `(skill, evalId)` pairs and, when a catalog is given, that every skill is in it.
 *
 * @example
 *   ```ts
 *   const results = parseEvalResults(await readFile('eval-results.json'), { catalog });
 *   ```;
 */
export function parseEvalResults(
  input: unknown,
  options: { catalog?: Pick<CatalogManifest, 'skills'> } = {}
): EvalResults {
  const parsed = EvalResultsSchema.safeParse(toJson(input, 'eval-results'));
  if (!parsed.success) {
    throw new ManifestError(
      'eval-results',
      parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('/'),
        message: issue.message,
      }))
    );
  }
  const results: EvalResults = parsed.data;
  const issues: ManifestIssue[] = [];
  if (results.summary.total !== results.results.length) {
    issues.push({
      path: 'summary/total',
      message: 'must equal the number of results',
    });
  }
  const passed = results.results.filter((result) => result.passed).length;
  if (results.summary.passed !== passed) {
    issues.push({
      path: 'summary/passed',
      message: 'must equal the number of passed results',
    });
  }
  const skills = options.catalog
    ? new Set(options.catalog.skills.map((skill) => skill.name))
    : undefined;
  const seen = new Set<string>();
  results.results.forEach((result, index) => {
    const key = JSON.stringify([result.skill, result.evalId]);
    if (seen.has(key)) {
      issues.push({
        path: `results/${index}`,
        message: 'repeats a (skill, evalId) pair',
      });
    }
    seen.add(key);
    if (skills && !skills.has(result.skill)) {
      issues.push({
        path: `results/${index}/skill`,
        message: 'names a skill that is not in the catalog',
      });
    }
  });
  if (issues.length > 0) throw new ManifestError('eval-results', issues);
  return results;
}
