export interface RemoteEntry {
  name: string;
  application_uid: string;
  remote_entry_url: string;
}

export {
  VIRTUAL_SPECIFIER,
  detectEnvReads,
  rewriteEnvReadsToVirtualModule,
  buildImportMap,
  injectImportMap,
  buildModulePreload,
  injectBeforeHeadClose,
  buildEnvJsonAsset,
  generateManifestContent,
  calculateManifestHash,
  collectZEPublicVars,
} from './env-var-rewrites';

export function buildEnvImportMap(
  appUid: string,
  remotes: RemoteEntry[]
): Record<string, string> {
  const imports: Record<string, string> = {};

  // Add the main env module mapping - now points to zephyr-manifest.json
  imports[`env:vars:${appUid}`] = '/zephyr-manifest.json';

  // Add environment variable manifest entries for remotes
  // Note: Module Federation remotes are loaded by MF runtime, not through import maps
  remotes.forEach((remote) => {
    if (remote.application_uid && remote.remote_entry_url) {
      // Environment variables manifest for the remote
      try {
        const urlStr = remote.remote_entry_url.includes('@')
          ? remote.remote_entry_url.split('@')[1]
          : remote.remote_entry_url;
        const origin = new URL(urlStr).origin;
        imports[`env:vars:${remote.application_uid}`] = `${origin}/zephyr-manifest.json`;
      } catch {
        // If URL parsing fails, skip the env:vars entry
        console.warn(
          `Failed to parse remote URL for env vars: ${remote.remote_entry_url}`
        );
      }
    }
  });

  return imports;
}

export function buildEnvModuleSource(applicationUid: string): string {
  // Collect all ZE_PUBLIC_* environment variables
  const envVars: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('ZE_PUBLIC_') && typeof value === 'string') {
      envVars[key] = value;
    }
  }

  // Generate the module source code
  const exports = Object.entries(envVars)
    .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`)
    .join('\n');

  // Include default export with all vars and the app UID
  const defaultExport = `
export default {
  APPLICATION_UID: ${JSON.stringify(applicationUid)},
  ${Object.entries(envVars)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(',\n  ')}
};`;

  return `// Zephyr Environment Variables Module
// Auto-generated for app: ${applicationUid}
${exports}
${defaultExport}
`;
}

export function buildEnvImportMapScript(appUid: string, remotes: RemoteEntry[]): string {
  const importMap = {
    imports: buildEnvImportMap(appUid, remotes),
  };

  return `<script type="importmap">${JSON.stringify(importMap, null, 2)}</script>`;
}
