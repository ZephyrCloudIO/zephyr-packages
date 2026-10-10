import * as fs from 'node:fs';
import path from 'node:path';
import {
  MCP_LIMITS,
  isSourceMapPath,
  mcpMimeTypeForPath,
  sha256Hex,
  validateMcpArtifact,
} from 'zephyr-agent';
import {
  type CatalogManifest,
  type CatalogSkill,
  type McpProviderDescriptor,
  ZEPHYR_MCP_CATALOG_FILENAME,
  ZEPHYR_MCP_PROVIDER_FILENAME,
} from 'zephyr-edge-contract';
import type { DoctorEvidence, DoctorFinding } from '../doctor/schema';
import { compareCodeUnits } from './classify';
import { findingsFromArtifactIssues, mcpFinding } from './findings';
import { SKILL_FILE_NAME, checkSkill } from './skill-rules';

/** Generator recorded in descriptors that ze-cli builds for skills repos. */
export const ZEPHYR_CLI_GENERATOR = 'zephyr-cli';

const SERVED_DIRECTORIES = new Set(['references', 'assets', 'scripts']);

export interface ScannedSkill {
  folder: string;
  /** Served files relative to the skill folder, including SKILL.md. */
  files: Map<string, Uint8Array>;
  /** Parsed frontmatter when the skill passed every error-level rule. */
  frontmatter?: Record<string, unknown>;
}

export interface SkillsRepoScan {
  findings: DoctorFinding[];
  skills: ScannedSkill[];
}

/**
 * Run the source-repo (R) rules over `<dir>/skills` and collect each skill's served files
 * with fail-on-error reads. Read-only; never executes repository code.
 */
export async function scanSkillsRepo(directory: string): Promise<SkillsRepoScan> {
  const findings: DoctorFinding[] = [];
  const skills: ScannedSkill[] = [];
  const skillsRoot = path.join(directory, 'skills');
  const entries = await readEntries(skillsRoot);

  for (const entry of entries) {
    // Excluded segments are never skills (contract section 1).
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (entry.isSymbolicLink()) {
      findings.push(
        mcpFinding('ZD0702', 'A symlinked skill folder is not included.', [
          { path: `skills/${entry.name}` },
        ])
      );
      continue;
    }
    if (!entry.isDirectory()) continue;

    const skill = await scanSkill(skillsRoot, entry.name, findings);
    skills.push(skill);
  }

  if (!skills.some((skill) => skill.files.has(SKILL_FILE_NAME))) {
    findings.push(
      mcpFinding(
        'ZD0701',
        'The directory is classified as an MCP provider but no skill folder contains SKILL.md and there are no tool files.',
        [{ path: 'skills' }]
      )
    );
  }
  if (skills.length > MCP_LIMITS.skills) {
    findings.push(
      mcpFinding('ZD0741', `A provider publishes at most ${MCP_LIMITS.skills} skills.`, [
        { path: 'skills', detail: `skills: ${skills.length}` },
      ])
    );
  }

  return { findings, skills };
}

export interface SkillsRepoArtifact {
  descriptor: McpProviderDescriptor;
  catalog: CatalogManifest;
  /** Exactly the upload set: descriptor, catalog and every served skill file. */
  files: Map<string, Uint8Array>;
  /** Findings from validating the built artifact against the contract. */
  findings: DoctorFinding[];
}

/**
 * Build the provider artifact for a skills repo in memory (contract section 2): no temp
 * directory and no writes. Skills and files are sorted in comparison order.
 */
export function buildSkillsRepoArtifact(
  scan: SkillsRepoScan,
  options: { name: string; generatorVersion: string }
): SkillsRepoArtifact {
  const skills: CatalogSkill[] = scan.skills
    .filter((skill) => skill.frontmatter)
    .sort((left, right) => compareCodeUnits(left.folder, right.folder))
    .map((skill) => ({
      name: skill.folder,
      path: `skills/${skill.folder}`,
      frontmatter: skill.frontmatter as CatalogSkill['frontmatter'],
      files: [...skill.files]
        .sort(([left], [right]) => compareCodeUnits(left, right))
        .map(([filePath, bytes]) => ({
          path: filePath,
          mimeType: mcpMimeTypeForPath(filePath),
          size: bytes.byteLength,
          sha256: sha256Hex(bytes),
        })),
    }));

  const descriptor: McpProviderDescriptor = {
    manifestVersion: 1,
    name: options.name,
    catalog: ZEPHYR_MCP_CATALOG_FILENAME,
    generator: { name: ZEPHYR_CLI_GENERATOR, version: options.generatorVersion },
  };
  const catalog: CatalogManifest = {
    manifestVersion: 1,
    provider: { name: options.name },
    skills,
    tools: [],
  };

  const files = new Map<string, Uint8Array>([
    [ZEPHYR_MCP_PROVIDER_FILENAME, toJsonBytes(descriptor)],
    [ZEPHYR_MCP_CATALOG_FILENAME, toJsonBytes(catalog)],
  ]);
  for (const skill of scan.skills) {
    if (!skill.frontmatter) continue;
    for (const [filePath, bytes] of skill.files) {
      files.set(`skills/${skill.folder}/${filePath}`, bytes);
    }
  }

  // Validate what will be uploaded exactly as zephyr-agent will, before any network work.
  const validation = validateMcpArtifact(files);
  return {
    descriptor,
    catalog,
    files,
    findings: findingsFromArtifactIssues(validation.issues),
  };
}

/** Stand-in descriptor name for checks that run before the identity is resolved. */
const PREFLIGHT_PROVIDER_NAME = 'preflight';

/**
 * Artifact rules for a skills repo before its provider name is known (doctor, and deploy
 * before ZephyrEngine.create). Only the descriptor name depends on the identity, and the
 * engine guarantees a valid skill name, so a placeholder exercises every other rule.
 */
export function checkSkillsRepoArtifact(scan: SkillsRepoScan): DoctorFinding[] {
  return buildSkillsRepoArtifact(scan, {
    name: PREFLIGHT_PROVIDER_NAME,
    generatorVersion: '0.0.0',
  }).findings;
}

async function scanSkill(
  skillsRoot: string,
  folder: string,
  findings: DoctorFinding[]
): Promise<ScannedSkill> {
  const skillRoot = path.join(skillsRoot, folder);
  const evidenceRoot = `skills/${folder}`;
  const files = new Map<string, Uint8Array>();
  const oversized = new Map<string, number>();
  const unknownEntries: DoctorEvidence[] = [];
  let evalsDirectory = false;

  for (const entry of await readEntries(skillRoot)) {
    const name = entry.name;
    if (name.startsWith('.') || name === 'node_modules') continue;
    if (entry.isSymbolicLink()) {
      unknownEntries.push({ path: `${evidenceRoot}/${name}`, detail: 'symlink' });
    } else if (name === SKILL_FILE_NAME && entry.isFile()) {
      await readServedFile(skillRoot, name, files, oversized);
    } else if (SERVED_DIRECTORIES.has(name) && entry.isDirectory()) {
      await walkServedDirectory(
        skillRoot,
        name,
        files,
        oversized,
        unknownEntries,
        evidenceRoot
      );
    } else if (name.toLowerCase() === 'evals') {
      evalsDirectory = name === 'evals' && entry.isDirectory();
      if (!evalsDirectory) unknownEntries.push({ path: `${evidenceRoot}/${name}` });
    } else {
      unknownEntries.push({ path: `${evidenceRoot}/${name}` });
    }
  }

  if (unknownEntries.length > 0) {
    findings.push(
      mcpFinding(
        'ZD0702',
        'A skill folder entry outside SKILL.md, references/, assets/, scripts/ and evals/ (or a symlink) is not included.',
        unknownEntries
      )
    );
  }

  const result = checkSkill({ folder, evidenceRoot, files, oversized });
  findings.push(...result.findings);
  if (evalsDirectory) {
    findings.push(...(await checkEvals(skillRoot, folder, evidenceRoot)));
  }

  return result.frontmatter
    ? { folder, files, frontmatter: result.frontmatter }
    : { folder, files };
}

async function walkServedDirectory(
  skillRoot: string,
  relativeDirectory: string,
  files: Map<string, Uint8Array>,
  oversized: Map<string, number>,
  unknownEntries: DoctorEvidence[],
  evidenceRoot: string
): Promise<void> {
  for (const entry of await readEntries(path.join(skillRoot, relativeDirectory))) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (
      entry.name.startsWith('.') ||
      entry.name === 'node_modules' ||
      entry.name.toLowerCase() === 'evals'
    ) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      unknownEntries.push({ path: `${evidenceRoot}/${relativePath}`, detail: 'symlink' });
    } else if (entry.isDirectory()) {
      await walkServedDirectory(
        skillRoot,
        relativePath,
        files,
        oversized,
        unknownEntries,
        evidenceRoot
      );
    } else if (entry.isFile() && !isSourceMapPath(entry.name)) {
      await readServedFile(skillRoot, relativePath, files, oversized);
    }
  }
}

async function readServedFile(
  skillRoot: string,
  relativePath: string,
  files: Map<string, Uint8Array>,
  oversized: Map<string, number>
): Promise<void> {
  const absolutePath = path.join(skillRoot, ...relativePath.split('/'));
  const { size } = await fs.promises.stat(absolutePath);
  if (size > MCP_LIMITS.skillFileBytes) {
    oversized.set(relativePath, size);
    return;
  }
  files.set(relativePath, await fs.promises.readFile(absolutePath));
}

async function checkEvals(
  skillRoot: string,
  folder: string,
  evidenceRoot: string
): Promise<DoctorFinding[]> {
  const evalsPath = path.join(skillRoot, 'evals', 'evals.json');
  const evidence = [{ path: `${evidenceRoot}/evals/evals.json` }];
  let value: unknown;
  try {
    const stats = await fs.promises.stat(evalsPath);
    if (stats.size > MCP_LIMITS.skillFileBytes) throw new Error('too large');
    value = JSON.parse(await fs.promises.readFile(evalsPath, 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    return [mcpFinding('ZD0720', 'evals/evals.json does not parse as JSON.', evidence)];
  }

  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const evals = record['evals'];
  const validShape =
    typeof record['skill_name'] === 'string' &&
    Array.isArray(evals) &&
    evals.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        'id' in item &&
        typeof (item as Record<string, unknown>)['prompt'] === 'string'
    );
  if (!validShape) {
    return [
      mcpFinding(
        'ZD0720',
        'evals/evals.json needs skill_name and an evals array of objects with id and prompt.',
        evidence
      ),
    ];
  }
  if (record['skill_name'] !== folder) {
    return [
      mcpFinding(
        'ZD0721',
        'evals/evals.json skill_name differs from the skill.',
        evidence
      ),
    ];
  }
  return [];
}

async function readEntries(directory: string): Promise<fs.Dirent[]> {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  return entries.sort((left, right) => compareCodeUnits(left.name, right.name));
}

function toJsonBytes(value: unknown): Uint8Array {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
