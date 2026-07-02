import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function getZephyrAgentVersion(): string {
  try {
    // Resolves to the package root from both src/ (tests) and dist/ (build output).
    const package_json = JSON.parse(
      readFileSync(join(__dirname, '../../../package.json'), 'utf8')
    ) as { version?: string };
    return package_json.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
