/**
 * Every check rule, with its stable ze-cli code. Rule ids and codes are a public contract
 * with ze-cli (`ZD07xx`): never rename or renumber one, only add new ones.
 */
export const RULES = {
  'repo-empty': { code: 'ZD0701', severity: 'error', modes: 'R' },
  'skill-unknown-entry': { code: 'ZD0702', severity: 'warning', modes: 'R' },
  'skill-missing-file': { code: 'ZD0710', severity: 'error', modes: 'R' },
  'skill-frontmatter-invalid': {
    code: 'ZD0711',
    severity: 'error',
    modes: 'RA',
  },
  'skill-name-invalid': { code: 'ZD0712', severity: 'error', modes: 'RA' },
  'skill-description-invalid': {
    code: 'ZD0713',
    severity: 'error',
    modes: 'RA',
  },
  'skill-metadata-invalid': { code: 'ZD0714', severity: 'error', modes: 'RA' },
  'skill-owner-missing': { code: 'ZD0715', severity: 'error', modes: 'RA' },
  'skill-link-broken': { code: 'ZD0716', severity: 'error', modes: 'RA' },
  'skill-too-long': { code: 'ZD0717', severity: 'warning', modes: 'RA' },
  'skill-secret': { code: 'ZD0718', severity: 'error', modes: 'RA' },
  'skill-file-too-large': { code: 'ZD0719', severity: 'error', modes: 'RA' },
  'evals-invalid': { code: 'ZD0720', severity: 'warning', modes: 'R' },
  'evals-skill-mismatch': { code: 'ZD0721', severity: 'warning', modes: 'R' },
  'tool-name-invalid': { code: 'ZD0730', severity: 'error', modes: 'RA' },
  'tool-hint-missing': { code: 'ZD0731', severity: 'error', modes: 'RA' },
  'tools-build-missing': { code: 'ZD0732', severity: 'error', modes: 'R' },
  'tool-secret': { code: 'ZD0733', severity: 'error', modes: 'RA' },
  'tool-name-reserved': { code: 'ZD0734', severity: 'error', modes: 'RA' },
  'tool-name-mismatch': { code: 'ZD0735', severity: 'error', modes: 'R' },
  'tool-export-invalid': { code: 'ZD0736', severity: 'error', modes: 'R' },
  'tool-schema-invalid': { code: 'ZD0737', severity: 'error', modes: 'RA' },
  'artifact-descriptor-invalid': {
    code: 'ZD0740',
    severity: 'error',
    modes: 'A',
  },
  'artifact-catalog-invalid': {
    code: 'ZD0741',
    severity: 'error',
    modes: 'A',
  },
  'artifact-path-denied': { code: 'ZD0742', severity: 'error', modes: 'A' },
  'catalog-name-clash': { code: 'ZD0743', severity: 'error', modes: 'RA' },
} as const satisfies Record<
  string,
  {
    code: `ZD07${string}`;
    severity: 'error' | 'warning';
    modes: 'R' | 'A' | 'RA';
  }
>;

/** A check rule id, e.g. `skill-name-invalid`. */
export type RuleId = keyof typeof RULES;

/** A ze-cli check code, e.g. `ZD0712`. */
export type RuleCode = (typeof RULES)[RuleId]['code'];

/**
 * An error that names the rule it broke, e.g. a tool schema that cannot be converted
 * (`tool-schema-invalid`, `ZD0737`).
 */
export class RuleError extends Error {
  readonly rule: RuleId;
  readonly code: RuleCode;

  constructor(rule: RuleId, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RuleError';
    this.rule = rule;
    this.code = RULES[rule].code;
  }
}
