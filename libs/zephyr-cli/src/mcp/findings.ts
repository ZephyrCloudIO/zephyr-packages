import type { McpArtifactIssue } from 'zephyr-agent';
import {
  DoctorMcpRuleId,
  type DoctorEvidence,
  type DoctorFinding,
  type DoctorMcpFindingCode,
  type DoctorSeverity,
} from '../doctor/schema';

/** Default severity of every ZD07xx code (contract section 8.2). */
const SEVERITY: Readonly<Record<DoctorMcpFindingCode, DoctorSeverity>> = {
  ZD0701: 'error',
  ZD0702: 'warning',
  ZD0710: 'error',
  ZD0711: 'error',
  ZD0712: 'error',
  ZD0713: 'error',
  ZD0714: 'error',
  ZD0715: 'error',
  ZD0716: 'error',
  ZD0717: 'warning',
  ZD0718: 'error',
  ZD0719: 'error',
  ZD0720: 'warning',
  ZD0721: 'warning',
  ZD0730: 'error',
  ZD0731: 'error',
  ZD0732: 'error',
  ZD0733: 'error',
  ZD0734: 'error',
  ZD0735: 'error',
  ZD0736: 'error',
  ZD0737: 'error',
  ZD0740: 'error',
  ZD0741: 'error',
  ZD0742: 'error',
  ZD0743: 'error',
};

const REMEDIATION: Readonly<Record<DoctorMcpFindingCode, string>> = {
  ZD0701:
    'Add skills/<skill-name>/SKILL.md, or tools/<tool_name>.ts built with the zephyr-mcp/rslib preset.',
  ZD0702:
    'Move the entry into references/, assets/ or scripts/, or delete it. It is not uploaded.',
  ZD0710: 'Add SKILL.md to the skill folder, or remove the folder.',
  ZD0711:
    'Start SKILL.md with a --- line, then YAML key: value pairs, then a closing --- line.',
  ZD0712:
    'Use a lowercase kebab-case name (1 to 64 characters, not "evals") that equals the folder name.',
  ZD0713: 'Set a frontmatter description of 1 to 1,024 characters.',
  ZD0714:
    'Quote every metadata value, license and allowed-tools as a string, and keep compatibility at most 500 characters.',
  ZD0715: 'Add metadata.owner and metadata.contact to the frontmatter.',
  ZD0716:
    'Link only to files inside the skill folder under references/, assets/ or scripts/.',
  ZD0717: 'Keep the SKILL.md body under 500 lines; move detail into references/.',
  ZD0718:
    'Remove the secret from the skill file and rotate it. Skills are served to every agent in the organization.',
  ZD0719:
    'Keep each skill file at most 5 MiB, and each skill at most 512 files and 16 MiB in total; move large or rarely used content out of the skill.',
  ZD0720:
    'Make evals/evals.json valid JSON with skill_name and an evals array of objects with id and prompt.',
  ZD0721: 'Set evals/evals.json skill_name to the skill folder name.',
  ZD0730: 'Rename the tool file to match ^[A-Za-z0-9_-]{1,64}$.',
  ZD0731:
    'Declare annotations.readOnlyHint or annotations.destructiveHint in defineTool.',
  ZD0732:
    'Build tools with the zephyr-mcp/rslib preset, then run npx zephyr-cli deploy dist.',
  ZD0733:
    'Remove the secret from the tool source and rotate it. Tool bundles are uploaded to Zephyr.',
  ZD0734:
    'Rename the tool; search, execute and connection_status are reserved by the Zephyr MCP.',
  ZD0735: 'Make the defineTool name equal the file name, or omit it.',
  ZD0736: 'Default-export defineTool({ description, handler }).',
  ZD0737:
    'Give the tool an input and output schema whose JSON Schema root is type "object".',
  ZD0740:
    'Rebuild with the zephyr-mcp/rslib preset; mcp-provider.json must match the contract exactly.',
  ZD0741:
    'Keep the generated catalog.json within its limits (524,288 bytes, 200 skills, 200 tools), serve skill files only as SKILL.md or under references/, assets/ or scripts/ (never node_modules), bundle tools/index.js into one file without imports, and do not edit the catalog or the files it lists by hand; rebuild tools repos with the zephyr-mcp/rslib preset.',
  ZD0742:
    'Remove evals, source maps, dotfiles and TypeScript sources under tools/ from the artifact.',
  ZD0743: 'Give every skill and every tool a unique name.',
};

/** Build one ZD07xx finding with its rule id, default severity and remediation. */
export function mcpFinding(
  code: DoctorMcpFindingCode,
  message: string,
  evidence: DoctorEvidence[],
  severity: DoctorSeverity = SEVERITY[code]
): DoctorFinding {
  return {
    code,
    rule: DoctorMcpRuleId[code],
    severity,
    message,
    evidence,
    remediation: REMEDIATION[code],
  };
}

/** Convert agent artifact issues to findings, one per code with every evidence path. */
export function findingsFromArtifactIssues(
  issues: readonly McpArtifactIssue[]
): DoctorFinding[] {
  const byCode = new Map<McpArtifactIssue['code'], DoctorEvidence[]>();
  for (const issue of issues) {
    const evidence = byCode.get(issue.code) ?? [];
    evidence.push({ path: issue.path, detail: boundDetail(issue.message) });
    byCode.set(issue.code, evidence);
  }
  return [...byCode].map(([code, evidence]) =>
    mcpFinding(code, ARTIFACT_MESSAGES[code], evidence)
  );
}

const ARTIFACT_MESSAGES: Readonly<Record<McpArtifactIssue['code'], string>> = {
  ZD0711: 'A served SKILL.md frontmatter is missing, is not YAML, or is not a mapping.',
  ZD0712: 'A catalog skill name or frontmatter name breaks the skill name rule.',
  ZD0713: 'A catalog skill description is missing or longer than 1,024 characters.',
  ZD0714:
    'A catalog skill has non-string metadata, license or allowed-tools, or compatibility longer than 500 characters.',
  ZD0719:
    'A catalog skill file is larger than 5 MiB, or a skill has more than 512 files or more than 16 MiB in total.',
  ZD0730: 'A catalog tool name does not match the tool name rule.',
  ZD0734: 'A catalog tool uses a reserved name.',
  ZD0737: 'A catalog tool schema is not a JSON Schema object.',
  ZD0740: 'mcp-provider.json is invalid.',
  ZD0741: 'catalog.json or the files it lists do not match the contract.',
  ZD0742: 'The artifact contains a path that is never uploaded.',
  ZD0743: 'The catalog lists a skill or tool name more than once.',
};

/** Format findings like `ze-cli doctor` text output (stderr friendly). */
export function formatFindingLines(findings: readonly DoctorFinding[]): string[] {
  const lines: string[] = [];
  for (const finding of findings) {
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.code} ${finding.message}`);
    for (const evidence of finding.evidence) {
      lines.push(
        `  Evidence: ${evidence.path}${evidence.line ? `:${evidence.line}` : ''}${evidence.detail ? ` — ${evidence.detail}` : ''}`
      );
    }
    lines.push(`  Remediation: ${finding.remediation}`);
  }
  return lines;
}

function boundDetail(value: string): string {
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}
