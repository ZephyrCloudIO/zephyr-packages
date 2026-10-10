import { compareStrings } from '../manifest/paths';
import { RULES, type RuleCode, type RuleId } from '../rules';

/** One problem found by a check. Never carries file contents. */
export interface Finding {
  /** Stable rule id, e.g. `skill-name-invalid`. */
  rule: RuleId;
  /** Stable ze-cli code, e.g. `ZD0712`. */
  code: RuleCode;
  severity: 'error' | 'warning';
  /** Project-relative evidence path with `/`, e.g. `skills/quote-a-deal/SKILL.md`. */
  path: string;
  message: string;
  /** The skill the finding is about, when there is one. */
  skill?: string;
  /** The tool the finding is about, when there is one. */
  tool?: string;
}

export const finding = (
  rule: RuleId,
  path: string,
  message: string,
  subject: { skill?: string; tool?: string } = {}
): Finding => ({
  rule,
  code: RULES[rule].code,
  severity: RULES[rule].severity,
  path,
  message,
  ...(subject.skill !== undefined && { skill: subject.skill }),
  ...(subject.tool !== undefined && { tool: subject.tool }),
});

/** Findings in a stable order: by path, then code, then message. */
export const sortFindings = (findings: Finding[]): Finding[] =>
  findings.sort(
    (left, right) =>
      compareStrings(left.path, right.path) ||
      compareStrings(left.code, right.code) ||
      compareStrings(left.message, right.message)
  );

/** Whether any finding is an error (warnings alone pass). */
export const hasErrors = (findings: readonly Finding[]): boolean =>
  findings.some((item) => item.severity === 'error');
