const fs = require('fs');
const path = require('path');

// Path to the Rspack plugin file
const rspackPluginPath = path.resolve(
  __dirname,
  '../../libs/zephyr-rspack-plugin/src/rspack-plugin/ze-rspack-plugin.ts'
);

// Path to the build snapshot file
const buildSnapshotPath = path.resolve(
  __dirname,
  '../../libs/zephyr-agent/src/lib/transformers/ze-build-snapshot.ts'
);

// Function to read a file
function readFile(filePath) {
  console.log(`Reading: ${filePath}`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  } else {
    console.error(`File not found: ${filePath}`);
    return null;
  }
}

// Function to write a file
function writeFile(filePath, content) {
  console.log(`Writing: ${filePath}`);
  fs.writeFileSync(filePath, content, 'utf8');
}

// Patch the Rspack plugin
function patchRspackPlugin() {
  const content = readFile(rspackPluginPath);
  if (!content) return;

  // Add a better logging statement to clearly show the setting of the baseHref
  const newContent = content.replace(
    /apply\(compiler: Compiler\): void {([\s\S]*?)this\._options\.zephyr_engine\.buildProperties\.output = compiler\.outputPath;/g,
    `apply(compiler: Compiler): void {
    // First log the initial state
    console.log('[RSPACK PLUGIN] Initial state:', {
      output: this._options.zephyr_engine.buildProperties.output,
      baseHref: this._options.zephyr_engine.buildProperties.baseHref
    });
      
    // Set the output path
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;`
  );

  // Add code to extract publicPath and set it as baseHref
  const newContentWithBaseHref = newContent.replace(
    /this\._options\.zephyr_engine\.buildProperties\.output = compiler\.outputPath;/g,
    `this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    
    // Extract publicPath from compiler options and use it as baseHref
    if (compiler.options?.output?.publicPath && 
        compiler.options.output.publicPath !== 'auto' && 
        typeof compiler.options.output.publicPath === 'string') {
      
      // Use publicPath as baseHref
      this._options.zephyr_engine.buildProperties.baseHref = compiler.options.output.publicPath;
      
      // Log the baseHref setting with high visibility
      console.log('\\n\\n[RSPACK PLUGIN] *** SETTING baseHref: ' + compiler.options.output.publicPath + ' ***\\n\\n');
    }
    
    // Log the final state after all modifications
    console.log('[RSPACK PLUGIN] Final state:', {
      output: this._options.zephyr_engine.buildProperties.output,
      baseHref: this._options.zephyr_engine.buildProperties.baseHref
    });`
  );

  // Write the updated file
  writeFile(rspackPluginPath, newContentWithBaseHref);
  console.log('Rspack plugin patched successfully!');
}

// Patch the build snapshot
function patchBuildSnapshot() {
  const content = readFile(buildSnapshotPath);
  if (!content) return;

  // Update the combinePathWithBaseHref function
  const newContent = content.replace(
    /function combinePathWithBaseHref\(baseHref: string \| undefined, assetPath: string\): string {[\s\S]*?return cleanBase \? `\${cleanBase}\/\${cleanPath}` : cleanPath;[\s\S]*?}/g,
    `function combinePathWithBaseHref(baseHref: string | undefined, assetPath: string): string {
  if (!baseHref) {
    return assetPath;
  }
  
  // Remove leading and trailing slashes from both parts
  const cleanBase = baseHref.replace(/^\\/|\\/$/g, '');
  const cleanPath = assetPath.replace(/^\\/|\\/$/g, '');
  
  // Only add the base if it's not empty
  const result = cleanBase ? \`\${cleanBase}/\${cleanPath}\` : cleanPath;
  
  // Log with high visibility
  console.log(\`\\n\\n[BUILD SNAPSHOT] *** Combining paths: \${baseHref} + \${assetPath} = \${result} ***\\n\\n\`);
  
  return result;
}`
  );

  // Update the assets reducer to use console.log
  const updatedContent = newContent.replace(
    /const baseHref = zephyr_engine\.buildProperties\.baseHref;[\s\S]*?memo\[assetPath\] = {[\s\S]*?path: assetPath,/g,
    `const baseHref = zephyr_engine.buildProperties.baseHref;
        
        // Log the baseHref with high visibility
        console.log('\\n\\n[BUILD SNAPSHOT] *** Using baseHref: ' + (baseHref || 'undefined') + ' ***\\n\\n');
        
        // Apply baseHref to create the path with baseHref prefix
        const assetPath = baseHref 
          ? combinePathWithBaseHref(baseHref, path)
          : path;
        
        // Log the asset path change
        console.log(\`[BUILD SNAPSHOT] Asset path change: "\${path}" → "\${assetPath}"\`);
        
        // Use the path with baseHref as the key in the assets map
        memo[assetPath] = { 
          // Also store the path with baseHref in the path field
          path: assetPath,`
  );

  // Write the updated file
  writeFile(buildSnapshotPath, updatedContent);
  console.log('Build snapshot patched successfully!');
}

// Run the patches
patchRspackPlugin();
patchBuildSnapshot();

console.log('Patching complete! Now you can build the packages and test them.');
