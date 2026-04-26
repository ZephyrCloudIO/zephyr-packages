import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function getZephyrAgentVersion(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '../../../package.json'), 'utf8')
    ) as { version?: string };

    return packageJson.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
