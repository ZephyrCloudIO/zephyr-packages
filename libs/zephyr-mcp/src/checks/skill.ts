import { parse } from 'yaml';
import { splitFrontmatter } from '../frontmatter';
import { LIMITS } from '../manifest/constants';
import { frontmatterIssues } from '../manifest/skill-rules';
import { decodeUtf8 } from '../mime';
import { finding, type Finding } from './finding';
import { brokenLinks } from './links';
import { findSecrets, textForSecretScan } from './secrets';
import { isObject } from '../object';

const MAX_BODY_LINES = 500;

export interface SkillFilesInput {
  /** The folder name. */
  name: string;
  /** Evidence path of the folder, e.g. `skills/quote-a-deal`. */
  path: string;
  /** Served files, `SKILL.md` included when there is one. */
  files: ReadonlyArray<{ path: string; bytes: Uint8Array }>;
}

export const parseFrontmatter = (
  markdown: string | undefined
): { frontmatter: Record<string, unknown>; body: string } | { error: string } => {
  if (markdown === undefined) return { error: 'SKILL.md is not valid UTF-8' };
  const split = splitFrontmatter(markdown);
  if (!split) {
    return {
      error:
        'SKILL.md must start with a "---" line, then YAML frontmatter, then a closing "---" line',
    };
  }
  let frontmatter: unknown;
  try {
    frontmatter = parse(split.yaml);
  } catch {
    return { error: 'SKILL.md frontmatter is not valid YAML' };
  }
  if (!isObject(frontmatter)) {
    return { error: 'SKILL.md frontmatter must be a YAML mapping' };
  }
  return { frontmatter, body: split.body };
};

const countLines = (text: string) =>
  text === '' ? 0 : text.replace(/\r?\n$/, '').split('\n').length;

/**
 * Checks one skill's served files, shared by repo and artifact checks: `SKILL.md`
 * frontmatter rules, links, length, secrets and size limits. Pass `frontmatter: 'parse'`
 * when the field rules were already checked elsewhere (an artifact's catalog) and only
 * the file's frontmatter block itself is in question, and `served` when links resolve
 * against a listing rather than the files at hand.
 */
export const checkSkillFiles = (
  skill: SkillFilesInput,
  options: {
    /**
     * `'all'` (default): every frontmatter rule. `'parse'`: only whether the frontmatter
     * block parses (ZD0711).
     */
    frontmatter?: 'all' | 'parse';
    /** Paths links may point at. Defaults to the paths in `files`. */
    served?: ReadonlySet<string>;
  } = {}
): Finding[] => {
  const findings: Finding[] = [];
  const subject = { skill: skill.name };
  const skillFile = skill.files.find((file) => file.path === 'SKILL.md');
  const skillPath = `${skill.path}/SKILL.md`;

  if (skillFile) {
    const markdown = decodeUtf8(skillFile.bytes);
    const parsed = parseFrontmatter(markdown);
    if ('error' in parsed) {
      findings.push(
        finding('skill-frontmatter-invalid', skillPath, parsed.error, subject)
      );
    } else {
      if ((options.frontmatter ?? 'all') === 'all') {
        for (const issue of frontmatterIssues(parsed.frontmatter, skill.name)) {
          findings.push(finding(issue.rule, skillPath, issue.message, subject));
        }
      }
      const lines = countLines(parsed.body);
      if (lines > MAX_BODY_LINES) {
        findings.push(
          finding(
            'skill-too-long',
            skillPath,
            `SKILL.md body has ${lines} lines; keep it under ${MAX_BODY_LINES} and move detail into references/`,
            subject
          )
        );
      }
    }
    // Links are read from the body only, as ze-cli does: a frontmatter
    // value that looks like Markdown is not a link. Without a frontmatter
    // block there is no body, and ZD0711 is already reported.
    const split = markdown === undefined ? undefined : splitFrontmatter(markdown);
    if (markdown !== undefined && split) {
      const served = options.served ?? new Set(skill.files.map((file) => file.path));
      const bodyStart = markdown.length - split.body.length;
      const offset = markdown.slice(0, bodyStart).split('\n').length - 1;
      // By line, never by quoting the target: messages carry no contents.
      for (const { line: bodyLine, reason } of brokenLinks(split.body, served)) {
        const line = bodyLine + offset;
        findings.push(
          finding(
            'skill-link-broken',
            skillPath,
            reason === 'outside'
              ? `a link on line ${line} points outside the skill folder; copy the file into references/`
              : `a link on line ${line} points at a file that is not served; served files live under references/, assets/ or scripts/`,
            subject
          )
        );
      }
    }
  }

  if (skill.files.length > LIMITS.filesPerSkill) {
    findings.push(
      finding(
        'skill-file-too-large',
        skill.path,
        `the skill has ${skill.files.length} files; the limit is ${LIMITS.filesPerSkill}`,
        subject
      )
    );
  }
  const totalBytes = skill.files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  if (totalBytes > LIMITS.skillTotalBytes) {
    findings.push(
      finding(
        'skill-file-too-large',
        skill.path,
        `the skill's files total ${totalBytes} bytes; the limit is 16 MiB`,
        subject
      )
    );
  }
  for (const file of skill.files) {
    const filePath = `${skill.path}/${file.path}`;
    if (file.bytes.byteLength > LIMITS.skillFileBytes) {
      findings.push(
        finding(
          'skill-file-too-large',
          filePath,
          `the file is ${file.bytes.byteLength} bytes; the limit is 5 MiB`,
          subject
        )
      );
    }
    // Every file, whatever its extension or encoding: a key in
    // assets/deploy.pem or a binary asset is as leaked as one in
    // references/setup.md.
    for (const { line, masked } of findSecrets(textForSecretScan(file.bytes))) {
      findings.push(
        finding(
          'skill-secret',
          filePath,
          `line ${line} looks like a secret (${masked}); remove it and rotate it`,
          subject
        )
      );
    }
  }
  return findings;
};
