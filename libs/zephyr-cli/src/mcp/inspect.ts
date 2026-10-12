import path from 'node:path';
import type { DoctorFinding, DoctorMcpState } from '../doctor/schema';
import { isDirectory, type McpClassification } from './classify';
import { inspectProviderArtifact } from './provider-artifact';
import { checkSkillsRepoArtifact, scanSkillsRepo } from './skills-repo';
import { scanToolsRepo } from './tools-repo';

export interface McpInspection {
  state: Omit<DoctorMcpState, 'packageChecks'>;
  findings: DoctorFinding[];
}

/**
 * ZD07xx checks for an MCP-classified directory, as run by `ze-cli doctor` (contract
 * section 8.1). Returns `undefined` for the legacy class.
 */
export async function inspectMcpDirectory(
  directory: string,
  classification: McpClassification
): Promise<McpInspection | undefined> {
  switch (classification.kind) {
    case 'legacy':
      return undefined;
    case 'provider-artifact': {
      const artifact = await inspectProviderArtifact(directory);
      return {
        state: {
          classification: 'provider-artifact',
          skills: artifact.catalog?.skills.map((skill) => skill.name) ?? [],
          tools: artifact.catalog?.tools.map((tool) => tool.name) ?? [],
          descriptor: 'mcp-provider.json',
        },
        findings: artifact.findings,
      };
    }
    case 'skills-repo': {
      const scan = await scanSkillsRepo(directory);
      // Same in-memory artifact checks a deploy runs, so doctor never passes a repo that
      // deploy would reject (for example a catalog over its size limit).
      const hasErrors = scan.findings.some(({ severity }) => severity === 'error');
      if (!hasErrors) scan.findings.push(...checkSkillsRepoArtifact(scan));
      return {
        state: {
          classification: 'skills-repo',
          skills: scan.skills.map((skill) => skill.folder),
          tools: [],
          descriptor: null,
        },
        findings: scan.findings,
      };
    }
    case 'tools-repo':
    case 'tools-without-package-json': {
      const hasPackageJson = classification.kind === 'tools-repo';
      const tools = await scanToolsRepo(directory, { hasPackageJson });
      const skills = (await isDirectory(path.join(directory, 'skills')))
        ? await scanSkillsRepo(directory)
        : undefined;
      // Rules that need the catalog (tool hints, schemas, name clashes) run on the
      // preset's built output, the same checks a `ze-cli deploy dist` would apply.
      const built =
        hasPackageJson && tools.built
          ? await inspectProviderArtifact(path.join(directory, 'dist'))
          : undefined;
      return {
        state: {
          classification: classification.kind,
          skills: skills?.skills.map((skill) => skill.folder) ?? [],
          tools: tools.tools,
          descriptor: tools.built ? 'dist/mcp-provider.json' : null,
        },
        // A tools repo with no skills is not empty; drop ZD0701 from the skills scan.
        findings: [
          ...tools.findings,
          ...(skills?.findings.filter(({ code }) => code !== 'ZD0701') ?? []),
          // Skill rules already ran on the source skills above; keep the rest.
          ...(built?.findings
            .filter(({ code }) => !/^ZD071\d$/.test(code))
            .map((finding) => withEvidencePrefix(finding, 'dist/')) ?? []),
        ],
      };
    }
  }
}

function withEvidencePrefix(finding: DoctorFinding, prefix: string): DoctorFinding {
  return {
    ...finding,
    evidence: finding.evidence.map((evidence) => ({
      ...evidence,
      path: `${prefix}${evidence.path}`,
    })),
  };
}
