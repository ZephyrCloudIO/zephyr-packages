/**
 * This script verifies if the Module Federation plugin is correctly applied Run it with
 * node check-module-federation.js after building the Next.js app
 */

const fs = require('fs');
const path = require('path');

// Function to check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Possible locations for the remoteEntry.js file
const possiblePaths = [
  path.join(__dirname, 'out', 'remoteEntry.js'),
  path.join(__dirname, '.next', 'remoteEntry.js'),
  path.join(__dirname, '.next', 'static', 'remoteEntry.js'),
  path.join(__dirname, '.next', 'static', 'chunks', 'remoteEntry.js'),
];

// Function to find Module Federation files recursively
function findModuleFederationFiles(dir, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return [];

  try {
    const results = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        const subResults = findModuleFederationFiles(fullPath, depth + 1, maxDepth);
        results.push(...subResults);
      } else if (
        item.name === 'remoteEntry.js' ||
        item.name.includes('federation') ||
        item.name.includes('remote')
      ) {
        results.push(fullPath);
      }
    }

    return results;
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
    return [];
  }
}

// Check specific paths
console.log('Checking for Module Federation files at specific paths:');
const foundAtSpecificPath = possiblePaths.find(fileExists);

if (foundAtSpecificPath) {
  console.log(`✓ Found remoteEntry.js at: ${foundAtSpecificPath}`);
} else {
  console.log('✗ remoteEntry.js not found at expected locations');

  // Search recursively
  console.log('\nSearching recursively for Module Federation files:');

  const outDirResults = findModuleFederationFiles(path.join(__dirname, 'out'));
  const nextDirResults = findModuleFederationFiles(path.join(__dirname, '.next'));

  const allResults = [...outDirResults, ...nextDirResults];

  if (allResults.length > 0) {
    console.log('Found potential Module Federation files:');
    allResults.forEach((file) => console.log(`- ${file}`));
  } else {
    console.log('No Module Federation files found after recursive search');
  }
}

// Check if zephyr directories exist
console.log('\nChecking for Zephyr directories:');
const zephyrDirs = [
  path.join(__dirname, '.zephyr'),
  path.join(__dirname, 'node_modules', '.zephyr'),
];

zephyrDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    console.log(`✓ Zephyr directory found: ${dir}`);
    // List contents
    try {
      const contents = fs.readdirSync(dir);
      console.log(`  Contents: ${contents.join(', ')}`);
    } catch (err) {
      console.log(`  Could not read directory contents: ${err.message}`);
    }
  } else {
    console.log(`✗ Zephyr directory not found: ${dir}`);
  }
});

console.log('\nCheck complete.');
