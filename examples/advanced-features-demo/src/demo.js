/**
 * Zephyr Advanced Features Demo
 * 
 * This file demonstrates using the advanced features of Zephyr:
 * - Semantic versioning support
 * - Fallback mechanisms
 * - Server-side rendering
 */

// --- Semver Example ---

// Host webpack/rspack configuration
const hostWebpackConfig = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      remotes: {
        // Traditional remote (no version or fallback)
        basicRemote: 'basic@https://example.com/basic/remoteEntry.js',
        
        // Versioned remote
        versionedRemote: {
          remote: 'versioned-app',
          version: '^1.0.0',
          options: {
            preferHighest: true,
            includePrerelease: false,
            strategy: 'compatible'
          }
        },
        
        // Remote with fallbacks
        fallbackRemote: {
          remote: 'fallback-app',
          version: '2.0.0',
          fallbacks: [
            'https://cdn1.example.com/fallback-app/2.0.0/remoteEntry.js',
            'https://cdn2.example.com/fallback-app/2.0.0/remoteEntry.js'
          ]
        },
        
        // Remote with SSR support
        ssrRemote: {
          remote: 'ssr-app',
          version: '1.0.0', 
          ssrEnabled: true
        },
        
        // Remote with all features
        advancedRemote: {
          remote: 'advanced-app',
          version: '^2.0.0',
          fallbacks: [
            'https://cdn1.example.com/advanced-app/2.0.0/remoteEntry.js',
            'https://cdn2.example.com/advanced-app/2.0.0/remoteEntry.js'
          ],
          ssrEnabled: true,
          options: {
            preferHighest: true,
            strategy: 'compatible'
          }
        }
      }
    })
  ]
};

// --- Runtime Code Examples ---

// Create enhanced runtime options
const runtimeOptions = {
  includeSemver: true,
  includeFallbacks: true,
  includeSSR: true,
  circuitBreakerEnabled: true,
  maxRetries: 3,
  initialRetryDelay: 500,
  plugins: [
    // Retry plugin
    createRetryPlugin({
      fetch: {
        retryTimes: 3,
        retryDelay: 1000
      },
      script: {
        retryTimes: 3,
        moduleName: ['critical-module']
      }
    }),
    
    // Semver plugin
    createSemverPlugin({
      strictVersionCheck: true,
      defaultRequirements: {
        'app1': '^1.0.0',
        'app2': '^2.0.0'
      }
    }),
    
    // SSR plugin
    createSSRPlugin({
      preloadRemotes: true,
      hydrateOnLoad: true
    })
  ]
};

// --- SSR Example Code ---

// Server-side code (Node.js)
async function serverRender() {
  // Import SSR utilities
  const { createSSRRemote, renderToString } = require('zephyr-ssr');
  
  // Create SSR-compatible remote
  const remote = await createSSRRemote('ssr-app', {
    version: '1.0.0',
    ssrEnabled: true
  });
  
  // Load a component from the remote
  const Component = await remote.get('./Button');
  
  // Render to HTML
  const html = renderToString(Component, { 
    text: 'Server Rendered Button' 
  });
  
  // Capture state for hydration
  const ssrStore = {
    'ssr-app': {
      './Button': { 
        text: 'Server Rendered Button',
        // Additional state to hydrate
        clickCount: 0
      }
    }
  };
  
  // Return HTML and state
  return {
    html,
    ssrStore: JSON.stringify(ssrStore)
  };
}

// Client-side hydration code
function clientHydration() {
  // Get SSR state from the page
  const ssrStoreScript = document.getElementById('__ZEPHYR_SSR_STORE__');
  if (ssrStoreScript) {
    window.__ZEPHYR_SSR_STORE = JSON.parse(ssrStoreScript.textContent);
  }
  
  // Import the remote component (will be hydrated automatically)
  import('ssr-app/Button').then(Button => {
    // Button component will hydrate with the server state
    const container = document.getElementById('button-container');
    render(Button.default, container);
  });
}

// Export examples for demonstration
export {
  hostWebpackConfig,
  runtimeOptions,
  serverRender,
  clientHydration
};