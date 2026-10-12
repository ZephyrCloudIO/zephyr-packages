import { posix } from 'node:path';
import {
  MCP_LIMITS,
  isValidMcpSkillName,
  parseMcpSkillMarkdown,
  type ParsedMcpSkillMarkdown,
} from 'zephyr-agent';
import type { DoctorEvidence, DoctorFinding } from '../doctor/schema';
import { mcpFinding } from './findings';
import { findSecrets } from './secrets';

export const SKILL_FILE_NAME = 'SKILL.md';
const MAX_BODY_LINES = 500;

export type ParsedSkillMarkdown = ParsedMcpSkillMarkdown;

/**
 * Split SKILL.md per contract section 1 with zephyr-agent's parser, the one its artifact
 * validation uses to compare a served SKILL.md with the catalog (amendment 13.4).
 */
export const parseSkillMarkdown: (bytes: Uint8Array) => ParsedSkillMarkdown | undefined =
  parseMcpSkillMarkdown;

export interface SkillCheckInput {
  /** Skill folder name, which must equal the frontmatter name. */
  folder: string;
  /** Project-relative evidence path of the skill folder, `/`-separated. */
  evidenceRoot: string;
  /** Served files relative to the skill folder, including SKILL.md. */
  files: ReadonlyMap<string, Uint8Array>;
  /** Served files that were too large to read, by path and byte size. */
  oversized?: ReadonlyMap<string, number>;
  /**
   * Check the per-skill file limits (ZD0719). Off for a provider artifact, where the
   * agent's catalog validation already reports them from the verified catalog sizes.
   */
  checkLimits?: boolean;
  /**
   * Skill-relative paths SKILL.md links may resolve to; defaults to `files`. An artifact
   * passes every catalog-listed path, so a listed file that is missing is reported once
   * by the artifact validation (ZD0741), not again as a broken link.
   */
  linkTargets?: ReadonlySet<string>;
}

export interface SkillCheckResult {
  findings: DoctorFinding[];
  /** Parsed frontmatter when SKILL.md is valid enough to publish. */
  frontmatter?: Record<string, unknown>;
}

/**
 * Skill rules shared by the source repo (R) and the artifact (A): ZD0710 to ZD0719. At
 * most one finding per code and skill; evidence never contains file contents.
 */
export function checkSkill({
  folder,
  evidenceRoot,
  files,
  oversized = new Map(),
  checkLimits = true,
  linkTargets,
}: SkillCheckInput): SkillCheckResult {
  const findings: DoctorFinding[] = [];
  const skillPath = `${evidenceRoot}/${SKILL_FILE_NAME}`;
  const skillMarkdown = files.get(SKILL_FILE_NAME);

  if (!skillMarkdown) {
    findings.push(
      mcpFinding('ZD0710', `Skill folder "${folder}" has no SKILL.md.`, [
        { path: evidenceRoot },
      ])
    );
    return { findings };
  }

  if (checkLimits) checkFileLimits(evidenceRoot, files, oversized, findings);
  const secrets = [...files].flatMap(([path, bytes]) =>
    findSecrets(`${evidenceRoot}/${path}`, bytes)
  );
  if (secrets.length > 0) {
    findings.push(
      mcpFinding('ZD0718', `Skill "${folder}" contains a likely secret.`, secrets)
    );
  }

  const parsed = parseSkillMarkdown(skillMarkdown);
  if (!parsed) {
    findings.push(
      mcpFinding(
        'ZD0711',
        'SKILL.md frontmatter is missing, is not YAML, or is not a mapping.',
        [{ path: skillPath, line: 1 }]
      )
    );
    return { findings };
  }

  const { frontmatter, body } = parsed;
  const name = frontmatter['name'];
  if (!isValidMcpSkillName(folder) || !isValidMcpSkillName(name) || name !== folder) {
    findings.push(
      mcpFinding(
        'ZD0712',
        'Skill name must match ^[a-z0-9]+(-[a-z0-9]+)*$ (1 to 64 characters, not "evals") and equal the folder name.',
        [{ path: skillPath, detail: `folder: ${boundName(folder)}` }]
      )
    );
  }

  const description = frontmatter['description'];
  if (
    typeof description !== 'string' ||
    description.length === 0 ||
    description.length > MCP_LIMITS.descriptionLength
  ) {
    findings.push(
      mcpFinding('ZD0713', 'Skill description must be 1 to 1,024 characters.', [
        {
          path: skillPath,
          detail:
            typeof description === 'string' ? `length: ${description.length}` : 'missing',
        },
      ])
    );
  }

  const metadata = frontmatter['metadata'];
  const compatibility = frontmatter['compatibility'];
  const badMetadata =
    metadata !== undefined &&
    (metadata === null ||
      typeof metadata !== 'object' ||
      Array.isArray(metadata) ||
      Object.values(metadata).some((value) => typeof value !== 'string'));
  const badCompatibility =
    compatibility !== undefined &&
    (typeof compatibility !== 'string' ||
      compatibility.length > MCP_LIMITS.compatibilityLength);
  // The catalog types license and allowed-tools as strings; like the catalog rule
  // (amendment 12.3), a non-string value is ZD0714, one finding with every bad key.
  const badKeys = [
    ...(badMetadata ? ['metadata'] : []),
    ...(badCompatibility ? ['compatibility'] : []),
    ...['license', 'allowed-tools'].filter(
      (key) => frontmatter[key] !== undefined && typeof frontmatter[key] !== 'string'
    ),
  ];
  if (badKeys.length > 0) {
    findings.push(
      mcpFinding(
        'ZD0714',
        'Skill metadata values, license and allowed-tools must be strings, and compatibility at most 500 characters.',
        [{ path: skillPath, detail: badKeys.join(', ') }]
      )
    );
  }

  // Metadata that is not a mapping is already ZD0714; only absent or mapping metadata
  // can be missing owner or contact, as in zephyr-mcp.
  const record =
    metadata === undefined
      ? {}
      : metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : undefined;
  const missing = record
    ? ['owner', 'contact'].filter(
        (key) => record[key] === undefined || record[key] === ''
      )
    : [];
  if (missing.length > 0) {
    findings.push(
      mcpFinding(
        'ZD0715',
        'Zephyr deploys require metadata.owner and metadata.contact.',
        [
          {
            path: skillPath,
            detail: `missing: ${missing.map((key) => `metadata.${key}`).join(', ')}`,
          },
        ]
      )
    );
  }

  const brokenLinks = findBrokenLinks(body, linkTargets ?? files).map((target) => ({
    path: skillPath,
    detail: `link: ${boundName(target)}`,
  }));
  if (brokenLinks.length > 0) {
    findings.push(
      mcpFinding(
        'ZD0716',
        'A relative link in SKILL.md resolves outside the skill folder or to a file that is not served.',
        brokenLinks
      )
    );
  }

  const bodyLines = countLines(body);
  if (bodyLines > MAX_BODY_LINES) {
    findings.push(
      mcpFinding('ZD0717', 'SKILL.md body is longer than 500 lines.', [
        { path: skillPath, detail: `lines: ${bodyLines}` },
      ])
    );
  }

  const publishable = !findings.some(({ severity }) => severity === 'error');
  return publishable ? { findings, frontmatter } : { findings };
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * SKILL.md lines outside fenced code blocks, with inline code spans removed. Like
 * CommonMark and zephyr-mcp: a fence is 3 or more backticks or tildes indented up to 3
 * spaces, closes only on the same character with at least the same length, and an
 * unclosed fence runs to the end; a code span closes on a run of the same length.
 */
export function markdownProseLines(markdown: string): string[] {
  const lines: string[] = [];
  let fence: string | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const marker = FENCE.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) {
        fence = undefined;
      }
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    lines.push(line.replace(/(`+)[\s\S]*?\1/g, ''));
  }
  return lines;
}

/** Relative Markdown link and image targets that are not served files of the skill. */
export function findBrokenLinks(
  body: string,
  files: ReadonlyMap<string, unknown> | ReadonlySet<string>
): string[] {
  const targets = markdownProseLines(body).flatMap((line) => [
    ...[...line.matchAll(/!?\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)/g)].map((m) => m[1]),
    ...[...line.matchAll(/^ {0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/g)].map((m) => m[1]),
  ]);

  const broken = new Set<string>();
  for (const raw of targets) {
    if (!raw) continue;
    const target = raw.replace(/^<|>$/g, '');
    if (
      /^[a-z][a-z0-9+.-]*:/i.test(target) ||
      target.startsWith('#') ||
      target.startsWith('/')
    ) {
      continue;
    }
    let path = target.replace(/[?#].*$/, '');
    try {
      path = decodeURIComponent(path);
    } catch {
      // keep the raw path
    }
    if (!path) continue;
    const resolved = posix.normalize(path);
    if (resolved === '..' || resolved.startsWith('../') || !files.has(resolved)) {
      broken.add(target);
    }
  }
  return [...broken];
}

function checkFileLimits(
  evidenceRoot: string,
  files: ReadonlyMap<string, Uint8Array>,
  oversized: ReadonlyMap<string, number>,
  findings: DoctorFinding[]
): void {
  const evidence: DoctorEvidence[] = [];
  const sizes = new Map<string, number>(oversized);
  for (const [path, bytes] of files) sizes.set(path, bytes.byteLength);
  let totalBytes = 0;
  for (const [path, size] of sizes) {
    totalBytes += size;
    if (size > MCP_LIMITS.skillFileBytes) {
      evidence.push({ path: `${evidenceRoot}/${path}`, detail: `bytes: ${size}` });
    }
  }
  if (sizes.size > MCP_LIMITS.filesPerSkill) {
    evidence.push({ path: evidenceRoot, detail: `files: ${sizes.size}` });
  }
  if (totalBytes > MCP_LIMITS.skillTotalBytes) {
    evidence.push({ path: evidenceRoot, detail: `total bytes: ${totalBytes}` });
  }
  if (evidence.length > 0) {
    findings.push(
      mcpFinding(
        'ZD0719',
        'A skill file is larger than 5 MiB, or the skill has more than 512 files or more than 16 MiB in total.',
        evidence
      )
    );
  }
}

function countLines(body: string): number {
  if (body === '') return 0;
  const lines = body.split('\n').length;
  return body.endsWith('\n') ? lines - 1 : lines;
}

function boundName(value: string): string {
  return value.length <= 120 ? value : `${value.slice(0, 117)}...`;
}
