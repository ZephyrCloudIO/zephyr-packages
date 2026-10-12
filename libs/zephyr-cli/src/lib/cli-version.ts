import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The installed zephyr-cli version, read from its package.json; `unknown` if unreadable. */
export function getZephyrCliVersion(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '../../package.json'), 'utf8')
    ) as { version?: string };
    return packageJson.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
