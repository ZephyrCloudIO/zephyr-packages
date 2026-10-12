import * as fs from 'node:fs';
import path from 'node:path';
import {
  expectedMcpArtifactPaths,
  isSafeMcpRelativePath,
  parseCatalogManifest,
  parseMcpJson,
  parseMcpProviderDescriptor,
  validateMcpArtifact,
} from 'zephyr-agent';
import {
  type CatalogManifest,
  type McpProviderDescriptor,
  ZEPHYR_MCP_PROVIDER_FILENAME,
} from 'zephyr-edge-contract';
import type { DoctorFinding } from '../doctor/schema';
import { compareCodeUnits } from './classify';
import { findingsFromArtifactIssues, mcpFinding } from './findings';
import { findSecrets } from './secrets';
import { SKILL_FILE_NAME, checkSkill } from './skill-rules';

export interface ProviderArtifactInspection {
  findings: DoctorFinding[];
  descriptor?: McpProviderDescriptor;
  catalog?: CatalogManifest;
  /** Exactly the contract upload set, read with fail-on-error. */
  files: Map<string, Uint8Array>;
  /** Files in the directory that are not part of the artifact and are not uploaded. */
  ignoredPaths: string[];
}

/**
 * Artifact-mode (A) checks for a built provider directory, e.g. the preset's `dist/`:
 * ZD0740 to ZD0743, skill rules on the artifact's skills, tool hints and secrets in the
 * runtime module. Reads only the files the catalog lists; extra files are reported as
 * ignored, never uploaded.
 */
export async function inspectProviderArtifact(
  directory: string
): Promise<ProviderArtifactInspection> {
  const files = new Map<string, Uint8Array>();
  const descriptorBytes = await readArtifactFile(directory, ZEPHYR_MCP_PROVIDER_FILENAME);
  const descriptorResult = parseMcpProviderDescriptor(descriptorBytes);
  if (!descriptorResult.descriptor) {
    return {
      findings: findingsFromArtifactIssues(descriptorResult.issues),
      files,
      ignoredPaths: [],
    };
  }
  const { descriptor } = descriptorResult;
  files.set(ZEPHYR_MCP_PROVIDER_FILENAME, descriptorBytes as Uint8Array);

  const catalogBytes = await readArtifactFile(directory, descriptor.catalog);
  const { catalog } = parseCatalogManifest(catalogBytes, descriptor, descriptor.catalog);
  if (catalogBytes) files.set(descriptor.catalog, catalogBytes);

  // A valid catalog names the upload set. An invalid one may still list denied paths;
  // pass every safe listed path through so the agent reports the same ZD0742 findings
  // at those paths as a deploy of the same output does (amendment 13.2). Nothing is
  // uploaded unless the catalog is valid.
  const listed = catalog
    ? expectedMcpArtifactPaths(descriptor, catalog)
    : rawListedPaths(catalogBytes);
  for (const artifactPath of listed) {
    if (files.has(artifactPath) || !isSafeMcpRelativePath(artifactPath)) continue;
    const bytes = await readArtifactFile(directory, artifactPath);
    if (bytes) files.set(artifactPath, bytes);
  }

  const findings = findingsFromArtifactIssues(
    validateMcpArtifact(files, { ignoreExtraPaths: true }).issues
  );
  if (!catalog) return { findings, descriptor, files, ignoredPaths: [] };

  const expectedSet = new Set(listed);
  const ignoredPaths = (await listFiles(directory)).filter(
    (file) => !expectedSet.has(file)
  );
  findings.push(...checkArtifactSkills(catalog, files));
  findings.push(...checkArtifactTools(catalog, files));
  return { findings, descriptor, catalog, files, ignoredPaths };
}

/**
 * Skill rules on each served skill. Frontmatter parsing (ZD0711) and its consistency with
 * the catalog (ZD0741) come from the agent's artifact validation, as does a missing
 * listed file (ZD0741), so links resolve against every catalog-listed file and a missing
 * file is reported once.
 */
function checkArtifactSkills(
  catalog: CatalogManifest,
  files: ReadonlyMap<string, Uint8Array>
): DoctorFinding[] {
  const findings: DoctorFinding[] = [];
  for (const skill of catalog.skills) {
    const skillFiles = new Map<string, Uint8Array>();
    for (const file of skill.files) {
      const bytes = files.get(`${skill.path}/${file.path}`);
      if (bytes) skillFiles.set(file.path, bytes);
    }
    if (!skillFiles.has(SKILL_FILE_NAME)) continue;
    findings.push(
      ...checkSkill({
        folder: skill.name,
        evidenceRoot: skill.path,
        files: skillFiles,
        linkTargets: new Set(skill.files.map((file) => file.path)),
        // validateMcpArtifact already reports ZD0719 from the verified catalog sizes.
        checkLimits: false,
      }).findings.filter(({ code }) => code !== 'ZD0711')
    );
  }
  return findings;
}

/** Skill file and runtime module paths an unvalidated catalog lists, as written. */
function rawListedPaths(catalogBytes: Uint8Array | undefined): string[] {
  const value = catalogBytes && parseMcpJson(catalogBytes);
  if (!isPlainObject(value)) return [];
  const paths: string[] = [];
  const skills = Array.isArray(value['skills']) ? (value['skills'] as unknown[]) : [];
  for (const skill of skills) {
    if (!isPlainObject(skill) || typeof skill['path'] !== 'string') continue;
    const skillFiles = Array.isArray(skill['files']) ? (skill['files'] as unknown[]) : [];
    for (const file of skillFiles) {
      if (isPlainObject(file) && typeof file['path'] === 'string') {
        paths.push(`${skill['path']}/${file['path']}`);
      }
    }
  }
  const runtime = value['runtime'];
  const modules =
    isPlainObject(runtime) && Array.isArray(runtime['modules'])
      ? (runtime['modules'] as unknown[])
      : [];
  for (const module of modules) {
    if (isPlainObject(module) && typeof module['path'] === 'string') {
      paths.push(module['path']);
    }
  }
  return paths;
}

function checkArtifactTools(
  catalog: CatalogManifest,
  files: ReadonlyMap<string, Uint8Array>
): DoctorFinding[] {
  const findings: DoctorFinding[] = [];
  const missingHints = catalog.tools
    .filter(
      (tool) =>
        tool.annotations?.readOnlyHint === undefined &&
        tool.annotations?.destructiveHint === undefined
    )
    .map((tool) => ({ path: 'catalog.json', detail: `tool: ${tool.name}` }));
  if (missingHints.length > 0) {
    findings.push(
      mcpFinding(
        'ZD0731',
        'A tool declares neither readOnlyHint nor destructiveHint.',
        missingHints
      )
    );
  }

  const secrets = (catalog.runtime?.modules ?? []).flatMap((module) => {
    const bytes = files.get(module.path);
    return bytes ? findSecrets(module.path, bytes) : [];
  });
  if (secrets.length > 0) {
    findings.push(
      mcpFinding('ZD0733', 'The tools bundle contains a likely secret.', secrets)
    );
  }
  return findings;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Read one artifact file; missing or non-regular files are `undefined`, other errors
 * throw.
 */
async function readArtifactFile(
  directory: string,
  artifactPath: string
): Promise<Uint8Array | undefined> {
  const absolutePath = path.join(directory, ...artifactPath.split('/'));
  try {
    const stats = await fs.promises.lstat(absolutePath);
    if (!stats.isFile()) return undefined;
    return await fs.promises.readFile(absolutePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
    throw error;
  }
}

async function listFiles(root: string, relativeDirectory = ''): Promise<string[]> {
  const entries = await fs.promises.readdir(path.join(root, relativeDirectory), {
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => compareCodeUnits(a.name, b.name))) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      files.push(...(await listFiles(root, relativePath)));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}
