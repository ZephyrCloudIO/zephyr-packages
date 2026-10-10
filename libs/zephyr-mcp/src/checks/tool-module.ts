import type { CatalogTool } from '../manifest/catalog';
import { toCatalogTool } from '../manifest/tool';
import { RuleError } from '../rules';
import type { ToolDefinition, ToolSchema } from '../types';
import { finding, type Finding } from './finding';
import { isObject } from '../object';

export interface ToolModuleInput {
  /** Repo-relative path, e.g. `tools/quote_price.ts`. */
  file: string;
  /** The tool name, from the file name. */
  name: string;
  /** The module's default export. */
  exported: unknown;
}

/**
 * R-mode checks on one built tool module (the Rslib preset runs them): a `defineTool`
 * default export with a description and handler, a `name` equal to the file name when
 * given, and schemas that convert to JSON Schema with an object root. Returns the catalog
 * entry when the module is usable.
 */
export function checkToolModule(input: ToolModuleInput): {
  findings: Finding[];
  tool?: CatalogTool;
} {
  const subject = { tool: input.name };
  const { exported } = input;
  if (!isObject(exported)) {
    return {
      findings: [
        finding(
          'tool-export-invalid',
          input.file,
          'the file has no default export; add `export default defineTool({ description, handler })`',
          subject
        ),
      ],
    };
  }
  const findings: Finding[] = [];
  if (exported['name'] !== undefined && exported['name'] !== input.name) {
    findings.push(
      finding(
        'tool-name-mismatch',
        input.file,
        `defineTool names the tool ${JSON.stringify(exported['name'])} but the file says "${input.name}"; drop the name or make them match`,
        subject
      )
    );
  }
  if (
    typeof exported['description'] !== 'string' ||
    exported['description'].length === 0
  ) {
    findings.push(
      finding('tool-export-invalid', input.file, 'the tool has no description', subject)
    );
  }
  if (typeof exported['handler'] !== 'function') {
    findings.push(
      finding(
        'tool-export-invalid',
        input.file,
        'the tool has no handler function',
        subject
      )
    );
  }
  if (findings.length > 0) return { findings };
  try {
    return {
      findings,
      tool: toCatalogTool(exported as ToolDefinition<ToolSchema | undefined>, {
        name: input.name,
      }),
    };
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    return {
      findings: [finding(error.rule, input.file, error.message, subject)],
    };
  }
}
