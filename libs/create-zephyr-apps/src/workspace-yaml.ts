import yaml from 'js-yaml';
import type { WorkspaceConfig } from './generate-pnpm-workspace.js';

export function workspaceConfigToYaml(config: WorkspaceConfig): string {
  return yaml.dump(config, { 
    indent: 2,
    lineWidth: -1,
    noRefs: true 
  });
}
