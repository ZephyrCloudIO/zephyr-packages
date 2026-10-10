import * as fs from 'node:fs';
import path from 'node:path';
import { MCP_RESERVED_TOOL_NAMES, isValidMcpToolName } from 'zephyr-agent';
import type { DoctorEvidence, DoctorFinding } from '../doctor/schema';
import { compareCodeUnits, isFile, listToolFiles } from './classify';
import { mcpFinding } from './findings';
import { findSecrets } from './secrets';

const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]s|tsx|jsx)$/;
const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_FILES = 2_000;

export interface ToolsRepoScan {
  findings: DoctorFinding[];
  /** Tool names derived from `tools/*.ts` file names. */
  tools: string[];
  /** `dist/mcp-provider.json` exists, so the preset's artifact can be checked. */
  built: boolean;
}

/**
 * Source-repo (R) tool rules ze-cli can check without executing code: ZD0730, ZD0733,
 * ZD0734, and ZD0732 when the preset's `dist/mcp-provider.json` is missing. ZD0735 to
 * ZD0737 need the module and are enforced by the zephyr-mcp/rslib preset.
 */
export async function scanToolsRepo(
  directory: string,
  options: { hasPackageJson: boolean }
): Promise<ToolsRepoScan> {
  const findings: DoctorFinding[] = [];
  const toolFiles = await listToolFiles(directory);
  const tools = toolFiles.map((fileName) => fileName.slice(0, -'.ts'.length));

  const invalid = toolFiles.filter(
    (fileName) => !isValidMcpToolName(fileName.slice(0, -3))
  );
  if (invalid.length > 0) {
    findings.push(
      mcpFinding(
        'ZD0730',
        'A tool file name does not match ^[A-Za-z0-9_-]{1,64}$.',
        invalid.map((fileName) => ({ path: `tools/${fileName}` }))
      )
    );
  }
  const reserved = toolFiles.filter((fileName) =>
    MCP_RESERVED_TOOL_NAMES.has(fileName.slice(0, -3))
  );
  if (reserved.length > 0) {
    findings.push(
      mcpFinding(
        'ZD0734',
        'A tool uses a name reserved by the Zephyr MCP.',
        reserved.map((fileName) => ({ path: `tools/${fileName}` }))
      )
    );
  }

  const secrets: DoctorEvidence[] = [];
  for (const sourcePath of await listSourceFiles(directory)) {
    const absolutePath = path.join(directory, ...sourcePath.split('/'));
    const { size } = await fs.promises.stat(absolutePath);
    if (size > MAX_SOURCE_FILE_BYTES) continue;
    secrets.push(...findSecrets(sourcePath, await fs.promises.readFile(absolutePath)));
  }
  if (secrets.length > 0) {
    findings.push(
      mcpFinding('ZD0733', 'A tool source file contains a likely secret.', secrets)
    );
  }

  const built = await isFile(path.join(directory, 'dist', 'mcp-provider.json'));
  if (!options.hasPackageJson) {
    findings.push(
      mcpFinding(
        'ZD0732',
        'Tool files need a package.json that depends on zephyr-mcp and builds with its Rslib preset.',
        [{ path: 'tools' }]
      )
    );
  } else if (!built) {
    findings.push(
      mcpFinding(
        'ZD0732',
        'Tool files are present but dist/mcp-provider.json was not built.',
        [{ path: 'dist/mcp-provider.json' }]
      )
    );
  }

  return { findings, tools, built };
}

async function listSourceFiles(
  root: string,
  relativeDirectory = 'tools'
): Promise<string[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(path.join(root, relativeDirectory), {
      withFileTypes: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => compareCodeUnits(a.name, b.name))) {
    if (files.length >= MAX_SOURCE_FILES) break;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(root, relativePath)));
    } else if (entry.isFile() && SOURCE_FILE_PATTERN.test(entry.name)) {
      files.push(relativePath);
    }
  }
  return files;
}
