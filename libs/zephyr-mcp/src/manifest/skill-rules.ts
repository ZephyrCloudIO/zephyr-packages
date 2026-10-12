import type { RuleId } from '../rules';
import {
  isSkillName,
  MAX_COMPATIBILITY_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SKILL_NAME_LENGTH,
} from '../validate';
import { isObject } from '../object';

/** A broken rule, before it becomes a finding or a parse error. */
export interface RuleIssue {
  rule: RuleId;
  message: string;
  /**
   * Whether the problem makes the document invalid, as opposed to a policy a deploy
   * enforces (owner and contact, tool hints).
   */
  fatal: boolean;
}

const OWNER_KEYS = ['owner', 'contact'] as const;

/**
 * The frontmatter rules every skill follows, wherever it is checked: in a repo, in an
 * artifact and in `catalog.json`. At most one issue per rule, so a skill with one problem
 * gets one finding.
 */
export const frontmatterIssues = (
  frontmatter: Record<string, unknown>,
  folderName: string
): RuleIssue[] => {
  const issues: RuleIssue[] = [];
  const add = (rule: RuleId, message: string, fatal = true) =>
    issues.push({ rule, message, fatal });

  const { name, description, compatibility, metadata } = frontmatter;
  if (typeof name !== 'string' || name.length === 0) {
    add('skill-name-invalid', 'frontmatter has no "name"');
  } else if (!isSkillName(name)) {
    // Messages never quote file contents; the folder name is the path.
    add(
      'skill-name-invalid',
      `frontmatter "name" is not a valid skill name: use 1-${MAX_SKILL_NAME_LENGTH} lowercase letters, digits and single hyphens, and not "evals"`
    );
  } else if (name !== folderName) {
    add(
      'skill-name-invalid',
      `frontmatter "name" differs from the folder name "${folderName}"; they must match`
    );
  }

  // 1 to 1,024 characters, as the contract counts them: no trimming.
  if (typeof description !== 'string' || description.length === 0) {
    add('skill-description-invalid', 'frontmatter has no "description"');
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    add(
      'skill-description-invalid',
      `description is ${description.length} characters; the limit is ${MAX_DESCRIPTION_LENGTH}`
    );
  }

  const metadataProblems: string[] = [];
  if (compatibility !== undefined) {
    if (typeof compatibility !== 'string') {
      metadataProblems.push('"compatibility" must be a string');
    } else if (compatibility.length > MAX_COMPATIBILITY_LENGTH) {
      metadataProblems.push(
        `"compatibility" is ${compatibility.length} characters; the limit is ${MAX_COMPATIBILITY_LENGTH}`
      );
    }
  }
  if (metadata !== undefined && !isObject(metadata)) {
    metadataProblems.push('"metadata" must be a mapping of strings');
  } else if (metadata) {
    const nonStrings = Object.keys(metadata).filter(
      (key) => typeof metadata[key] !== 'string'
    );
    if (nonStrings.length > 0) {
      metadataProblems.push(
        `metadata ${nonStrings.map((key) => `"${key}"`).join(', ')} must be ${nonStrings.length === 1 ? 'a string' : 'strings'}; quote the value in YAML`
      );
    }
  }
  // Field types are ZD0714 (contract 12.3); ZD0711 is only a frontmatter
  // block that is missing, not YAML or not a mapping.
  for (const key of ['license', 'allowed-tools'] as const) {
    if (frontmatter[key] !== undefined && typeof frontmatter[key] !== 'string') {
      metadataProblems.push(`"${key}" must be a string`);
    }
  }
  if (metadataProblems.length > 0) {
    add('skill-metadata-invalid', metadataProblems.join('; '));
  }

  // A non-string value is already reported above; only absence counts here.
  if (metadata === undefined || isObject(metadata)) {
    const missing = OWNER_KEYS.filter((key) => {
      const value = metadata?.[key];
      return value === undefined || value === '';
    });
    if (missing.length > 0) {
      add(
        'skill-owner-missing',
        `metadata needs ${missing.map((key) => `"${key}"`).join(' and ')} so people know who owns the skill, e.g. metadata: { owner: billing, contact: "#billing-team" }`,
        false
      );
    }
  }
  return issues;
};
