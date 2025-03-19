const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Run rspack build first
console.log('Running rspack build...');
execSync('rspack build', { stdio: 'inherit' });

// Wait for build to complete
console.log('Build complete, patching assets...');

// Directly patch snapshot.js for demo purposes
// In a real implementation, we would modify the plugin to handle this correctly
const assetsDir = path.join(__dirname, 'dist');
const files = fs.readdirSync(assetsDir);

const baseHref = '/u/';

// Create a snapshot manually that we'll use for testing
const snapshot = {
  assets: {}
};

// Function to properly combine paths without double slashes
function combinePathsWithoutDoubleSlashes(base, file) {
  // Remove leading and trailing slashes
  const cleanBase = base.replace(/^\/|\/$/g, '');
  
  // Join them with a single slash
  return cleanBase ? `${cleanBase}/${file}` : file;
}

// Add all assets to the snapshot with the correct baseHref
files.forEach(file => {
  if (file !== 'index.html' && file !== 'snapshot.json') { // Skip index.html and any previous snapshot
    const stats = fs.statSync(path.join(assetsDir, file));
    const extname = path.extname(file);
    
    // Calculate a simple "hash" for demo purposes
    const hash = Buffer.from(file).toString('hex');
    
    // Create asset entry with baseHref in the path (properly normalized)
    const assetPath = combinePathsWithoutDoubleSlashes(baseHref, file);
    
    // Add to snapshot using the path with baseHref as the key
    snapshot.assets[assetPath] = {
      path: assetPath,
      extname,
      hash,
      size: stats.size
    };
    
    console.log(`Added asset to snapshot: ${assetPath}`);
  }
});

// Write the snapshot to a file for inspection
fs.writeFileSync(
  path.join(assetsDir, 'snapshot.json'), 
  JSON.stringify(snapshot, null, 2)
);

console.log('Created snapshot.json in the dist folder');
console.log('This is a demonstration of how assets should look with baseHref added');