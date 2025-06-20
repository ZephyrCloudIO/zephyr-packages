#!/usr/bin/env node

async function testUrl() {
  const baseUrl = 'https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app';
  
  console.log('Testing Zephyr URL structure...\n');
  
  const paths = [
    '/remoteEntry.js',
    '/main.js', 
    '/index.js',
    '/bundle.js',
    '/server.js',
    '/github.js',
    '/src_github-tools_ts.js',
    '/__federation_expose_github.js',
  ];
  
  for (const path of paths) {
    const url = baseUrl + path;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        console.log(`✓ Found: ${url} (${response.headers.get('content-length')} bytes)`);
      } else {
        console.log(`✗ Not found: ${url} (${response.status})`);
      }
    } catch (error) {
      console.log(`✗ Error: ${url} - ${error.message}`);
    }
  }
  
  // Try to fetch remoteEntry.js content
  console.log('\n\nFetching remoteEntry.js content...');
  try {
    const response = await fetch(baseUrl + '/remoteEntry.js');
    const content = await response.text();
    console.log('First 500 characters:');
    console.log(content.substring(0, 500));
  } catch (error) {
    console.log('Failed to fetch remoteEntry.js:', error);
  }
}

testUrl().catch(console.error);