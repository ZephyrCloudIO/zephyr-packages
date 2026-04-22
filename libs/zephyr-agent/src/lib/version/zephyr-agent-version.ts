import package_json from '../../../package.json';

export function getZephyrAgentVersion(): string {
  return package_json.version ?? 'unknown';
}
