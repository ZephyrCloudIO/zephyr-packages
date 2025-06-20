// This file is used as the entry point for bundling
// The actual server is exposed via Module Federation

export { default as createGitHubToolsServer } from './github-tools';

// When running standalone (not via federation)
if (require.main === module) {
  console.log('GitHub Tools MCP Server');
  console.log('======================');
  console.log('This server provides GitHub integration tools.');
  console.log('');
  console.log('Exposed via Module Federation:');
  console.log('  - ./github -> GitHub tools server');
  console.log('');
  console.log('To use this server:');
  console.log('1. Build: npm run build');
  console.log('2. Upload to Zephyr: automatic after build');
  console.log('3. Access via Zephyr Host MCP Server');
}