/**
 * Runtime patch for Module Federation manifest URLs
 *
 * This module generates code that will patch the Module Federation runtime to intercept
 * and redirect manifest fetch requests to the Zephyr-deployed URLs.
 */
export function generateRuntimePatch(remoteEntries: Record<string, string>): string {
  // Create a mapping of original URLs to Zephyr URLs
  const urlMappings = Object.entries(remoteEntries)
    .filter(
      ([_, url]) =>
        url &&
        typeof url === 'string' &&
        (url.includes('/mf-manifest.json') || url.endsWith('.json'))
    )
    .map(([name, url]) => ({
      name,
      originalUrl: url,
    }));

  if (urlMappings.length === 0) {
    return '';
  }

  // Generate runtime code to patch the fetch function
  return `
// Zephyr Module Federation URL Patch
(function() {
  const originalFetch = window.fetch;
  const remoteManifestPatches = ${JSON.stringify(urlMappings, null, 2)};
  console.log('[Zephyr] Setting up Module Federation URL patches:', remoteManifestPatches);
  
  // Create patch for window.fetch
  window.fetch = function(...args) {
    let url = args[0];
    let patchedUrl = url;

    // Check if this is a Module Federation manifest fetch
    if (typeof url === 'string') {
      for (const patch of remoteManifestPatches) {
        if (url.includes(patch.originalUrl)) {
          // Check for Zephyr domain
          const currentDomain = window.location.hostname;
          if (currentDomain.includes('zephyr-cloud')) {
            const manifestFileName = 'mf-manifest.json';
            patchedUrl = 'https://' + currentDomain + '/' + manifestFileName;
            console.log('[Zephyr] Patching MF manifest URL:', { 
              originalUrl: url, 
              patched: patchedUrl 
            });
            args[0] = patchedUrl;
            break;
          }
        }
      }
    }
    
    return originalFetch.apply(this, args);
  };
})();
`;
}

/** Creates a Rolldown plugin to inject the runtime patch */
export function createRuntimePatchPlugin(remoteEntries: Record<string, string>): any {
  const patchCode = generateRuntimePatch(remoteEntries);

  if (!patchCode) {
    return null;
  }

  return {
    name: 'zephyr-mf-runtime-patch',

    // Run right after module federation plugin
    enforce: 'post',

    // Generate a module that will be loaded before all others
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'zephyr-mf-runtime-patch.js',
        source: patchCode,
      });
    },

    // Modify the HTML to include our patch script
    transformIndexHtml(html: string) {
      if (!html.includes('zephyr-mf-runtime-patch.js')) {
        // Add the script right before the closing head tag
        return html.replace(
          '</head>',
          '<script src="./zephyr-mf-runtime-patch.js"></script></head>'
        );
      }
      return html;
    },
  };
}
