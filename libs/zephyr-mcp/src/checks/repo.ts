import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { PROVIDER_DESCRIPTOR_FILE } from '../manifest/constants';
import { decodeUtf8 } from '../mime';
import { scanRepo, type RepoFile, type ScannedSkillFolder } from '../repo/scan';
import { RESERVED_TOOL_NAMES, TOOL_NAME_PATTERN } from '../validate';
import { finding, sortFindings, type Finding } from './finding';
import { findSecrets, textForSecretScan } from './secrets';
import { checkSkillFiles } from './skill';
import { isObject } from '../object';

export interface CheckRepoOptions {
  /**
   * Set by the Rslib preset, which is the build: tool files then do not need an existing
   * `dist/mcp-provider.json`.
   */
  building?: boolean;
}

const PACKAGE_NAME = 'zephyr-mcp';
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

const readJson = async (file: string): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
};

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false
  );

// The zephyr.config files zephyr-agent loads; there is no JSON config.
const ZEPHYR_CONFIG_FILES = [
  'zephyr.config.ts',
  'zephyr.config.mts',
  'zephyr.config.cts',
  'zephyr.config.js',
  'zephyr.config.mjs',
  'zephyr.config.cjs',
];
const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
const MCP_TRUE = /(?:^|[{,\s])["']?mcp["']?\s*:\s*true\b/;

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// Whether `<dir>/zephyr.config.*` sets a literal `mcp: true`, read without
// running it: the same static rule as ze-cli doctor (contract 11.7).
const configOptsIn = async (root: string): Promise<boolean> => {
  for (const name of ZEPHYR_CONFIG_FILES) {
    const file = path.join(root, name);
    const size = await stat(file).then(
      (stats) => (stats.isFile() ? stats.size : undefined),
      () => undefined
    );
    if (size === undefined || size > MAX_CONFIG_BYTES) continue;
    const source = await readFile(file, 'utf8').catch(() => '');
    if (MCP_TRUE.test(stripComments(source))) return true;
  }
  return false;
};

// Opt-in: a dependency field names the package, or `<dir>/zephyr.config.*`
// sets a literal `mcp: true`. The preset running at all (`building`) is
// proof of opt-in.
const isOptedIn = async (
  root: string,
  manifest: Record<string, unknown>
): Promise<boolean> =>
  DEPENDENCY_FIELDS.some(
    (field) => isObject(manifest[field]) && Object.hasOwn(manifest[field], PACKAGE_NAME)
  ) || (await configOptsIn(root));

// ZD0732 evidence: the missing descriptor once the repo opts in, else the
// tools folder that needs a build setup (contract 13.3).
const buildProblem = async (
  root: string,
  building: boolean
): Promise<{ path: string; message: string } | undefined> => {
  const manifest = await readJson(path.join(root, 'package.json'));
  if (!isObject(manifest)) {
    return {
      path: 'tools',
      message:
        'tool files need a package.json that builds them with the zephyr-mcp/rslib preset',
    };
  }
  if (building) return undefined;
  if (!(await isOptedIn(root, manifest))) {
    return {
      path: 'tools',
      message: `package.json must depend on ${PACKAGE_NAME} (or zephyr.config must set mcp: true) to build tool files`,
    };
  }
  if (!(await exists(path.join(root, 'dist', PROVIDER_DESCRIPTOR_FILE)))) {
    return {
      path: `dist/${PROVIDER_DESCRIPTOR_FILE}`,
      message:
        'dist/mcp-provider.json is missing: build with the zephyr-mcp/rslib preset and run ze-cli deploy dist',
    };
  }
  return undefined;
};

const checkEvals = (folder: ScannedSkillFolder, evals: RepoFile): Finding[] => {
  const evalsPath = `${folder.path}/${evals.path}`;
  const subject = { skill: folder.name };
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(evals.bytes) ?? '');
  } catch {
    return [finding('evals-invalid', evalsPath, 'evals.json is not valid JSON', subject)];
  }
  const valid =
    isObject(parsed) &&
    typeof parsed['skill_name'] === 'string' &&
    Array.isArray(parsed['evals']) &&
    parsed['evals'].every(
      (item) =>
        isObject(item) &&
        (typeof item['id'] === 'number' || typeof item['id'] === 'string') &&
        typeof item['prompt'] === 'string'
    );
  if (!valid) {
    return [
      finding(
        'evals-invalid',
        evalsPath,
        'evals.json needs "skill_name" and an "evals" array of objects with "id" and "prompt" (the skill-creator format)',
        subject
      ),
    ];
  }
  if ((parsed as { skill_name: string }).skill_name !== folder.name) {
    return [
      finding(
        'evals-skill-mismatch',
        evalsPath,
        `evals.json "skill_name" differs from the skill "${folder.name}"`,
        subject
      ),
    ];
  }
  return [];
};

/**
 * R-mode checks on a skills-and-tools repo (ze-cli doctor, skills-repo deploy, the Rslib
 * preset): skill folders and their files, frontmatter, links, secrets, limits, evals,
 * tool file names, tool sources and the build setup. Returns every finding; never throws
 * for a broken repo.
 *
 * @example
 *   ```ts
 *   const findings = await checkRepo('.');
 *   for (const { code, severity, path, message } of findings) {
 *   console.log(`${code} ${severity} ${path}: ${message}`);
 *   }
 *   ```
 */
export async function checkRepo(
  root: string,
  options: CheckRepoOptions = {}
): Promise<Finding[]> {
  const scan = await scanRepo(root);
  // Only a repo that classifies as MCP gets ZD07xx findings (contract
  // 13.3): a `skills/` folder or tool files. Anything else, such as an
  // ordinary package, is not this check's business.
  if (!scan.hasSkillsDir && scan.tools.length === 0) return [];
  const findings: Finding[] = [];

  for (const folder of scan.skillFolders) {
    const subject = { skill: folder.name };
    // Unknown entries are reported with or without SKILL.md (contract 12.6).
    for (const entry of folder.unknownEntries) {
      findings.push(
        finding(
          'skill-unknown-entry',
          entry,
          'only SKILL.md, references/, assets/, scripts/ and evals/ belong in a skill folder, and symlinks are never included; this entry is not published',
          subject
        )
      );
    }
    if (!folder.hasSkillFile) {
      findings.push(
        finding(
          'skill-missing-file',
          folder.path,
          'the skill folder has no SKILL.md; add one or remove the folder',
          subject
        )
      );
      continue;
    }
    findings.push(...checkSkillFiles(folder));
    if (folder.evals) findings.push(...checkEvals(folder, folder.evals));
  }
  for (const link of scan.skillLinks) {
    findings.push(
      finding('skill-unknown-entry', link, 'symlinked skill folders are never included', {
        skill: link.slice('skills/'.length),
      })
    );
  }

  const hasSkills = scan.skillFolders.some((folder) => folder.hasSkillFile);
  if (!hasSkills && scan.tools.length === 0) {
    findings.push(
      finding(
        'repo-empty',
        'skills',
        'no skills/<name>/SKILL.md and no tools/<name>.ts: nothing to publish'
      )
    );
  }

  for (const file of scan.tools) {
    const name = file.slice('tools/'.length, -'.ts'.length);
    const subject = { tool: name };
    if (!TOOL_NAME_PATTERN.test(name)) {
      findings.push(
        finding(
          'tool-name-invalid',
          file,
          `"${name}" is not a valid tool name: use 1-64 letters, digits, "_" or "-"`,
          subject
        )
      );
    } else if (RESERVED_TOOL_NAMES.includes(name)) {
      findings.push(
        finding(
          'tool-name-reserved',
          file,
          `"${name}" is reserved by the Zephyr MCP; rename the file`,
          subject
        )
      );
    }
  }
  for (const source of scan.toolSources) {
    for (const { line, masked } of findSecrets(textForSecretScan(source.bytes))) {
      findings.push(
        finding(
          'tool-secret',
          source.path,
          `line ${line} looks like a secret (${masked}); read it from the environment instead and rotate it`
        )
      );
    }
  }
  if (scan.tools.length > 0) {
    const problem = await buildProblem(scan.root, options.building ?? false);
    if (problem) {
      findings.push(finding('tools-build-missing', problem.path, problem.message));
    }
  }
  return sortFindings(findings);
}
