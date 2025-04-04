# BaseHref Implementation Plan for Zephyr Plugins

## Overview

This document outlines the implementation plan for adding baseHref capabilities to Zephyr plugins.
The implementation will focus on both xpack plugins (webpack/rspack) and rollup/rolldown plugins to ensure consistent behavior across all supported build tools.

## Current Analysis

Based on the detailed codebase analysis:

1. Assets are processed by the Zephyr build system and uploaded through the `uploadFile` function, which uses the original asset path in the upload process.

2. We need to extract the baseHref from `publicPath` for webpack/rspack or `base` for vite/rolldown/rollup property from the configuration objects passed to the plugins, but shouldn't modify the `withZephyr` function parameters.

3. When a baseHref (e.g., "/u/") is provided in the config, all assets should be uploaded to paths prefixed with this baseHref (e.g., "js/main.js" → "u/js/main.js").

4. When an output public path is specified then the url for the assets being uploaded should include the public path. Paths should be like "js/main.js" → "u/js/main.js"

5. The actual content of HTML files and other assets doesn't need to be modified - we only need to change the upload paths.

## Implementation Strategy

1. Add baseHref property to ZephyrEngine's buildProperties in `/libs/zephyr-agent/src/zephyr-engine/index.ts`

   - Added an optional `baseHref` string property to the `BuildProperties` interface

2. Update the applyBaseHrefToAssets function in `/libs/zephyr-agent/src/lib/transformers/ze-basehref-handler.ts` to ensure it works consistently

   - Added a `normalizeBasePath` function to standardize base path handling
   - Enhanced the main function to handle edge cases properly
   - Added special handling for index.html files to keep them at the root
   - Maintained existing behavior for absolute URLs and files with protocol

3. Ensure the webpack/rspack integration is complete in `/libs/zephyr-xpack-internal/src/basehref/webpack-basehref-integration.ts`

   - Updated to store baseHref in ZephyrEngine's buildProperties
   - Added ZephyrEngine parameter to the processWebpackBaseHref function

4. Update the Vite plugin implementation in `/libs/vite-plugin-zephyr/src/lib/internal/extract/extract_vite_assets_map.ts`

   - Added code to store the base path in ZephyrEngine's buildProperties
   - Maintained existing asset map transformation functionality

5. Ensure the Rollup plugin implementation in `/libs/rollup-plugin-zephyr/src/lib/transform/get-assets-map.ts` extracts the baseHref correctly

   - Enhanced detection of base path from Rollup options
   - Added fallback to directory path if explicit base not provided
   - Added storage of baseHref in ZephyrEngine (global instance)

6. Update the Rolldown plugin implementation in `/libs/zephyr-rolldown-plugin/src/lib/internal/get-assets-map.ts` to match

   - Mirrored improvements from Rollup plugin

7. Update webpack and rspack plugins with direct baseHref handling

   - Modified the Ze[Webpack|Rspack]Plugin to extract and store baseHref from various sources
   - Added priority logic: Plugin options > HTML Plugin > publicPath
   - Ensured baseHref is stored in ZephyrEngine's buildProperties

8. Update build-webpack-assets-map.ts to pass ZephyrEngine to the baseHref handler

   - Added zephyr_engine parameter to BuildWebpackAssetMapOptions interface
   - Updated ze-xpack-upload-agent.ts to pass the zephyr_engine

9. Added unit tests for the baseHref functionality

   - Created ze-basehref-handler.spec.ts with comprehensive test cases

10. Do not make any commits

## Example Usage

There are three sample applications

1. examples/rspack-base-href, this example uses rspack and a simple hardcoded publicPath of /u/. Assets should persist like /u/main.js
2. examples/basehref-example/vite, this example uses vite and a hardcoded 'base' of js. Assets should persist like /js/main.js
3. examples/basehref-example/webpack, this example uses an environment variable for public path when publicPath is set to "assets", Assets should persist like /assets/main.js

## Testing Plan

1. Create unit tests for baseHref extraction

   ```typescript
   // Example test for libs/zephyr-agent/src/lib/transformers/ze-basehref-handler.spec.ts
   import { applyBaseHrefToAssets } from './ze-basehref-handler';
   import { ZeBuildAssetsMap } from 'zephyr-edge-contract';

   describe('BaseHref Handler', () => {
     it('should normalize and apply base paths correctly', () => {
       const mockAssets: ZeBuildAssetsMap = {
         hash1: { path: 'js/main.js', hash: 'hash1', size: 100, buffer: Buffer.from('content') },
         hash2: { path: 'css/styles.css', hash: 'hash2', size: 100, buffer: Buffer.from('content') },
         hash3: { path: 'index.html', hash: 'hash3', size: 100, buffer: Buffer.from('content') },
       };

       // Case 1: Leading slash should be removed
       const result1 = applyBaseHrefToAssets(mockAssets, '/u');
       expect(result1['hash1'].path).toBe('u/js/main.js');
       expect(result1['hash2'].path).toBe('u/css/styles.css');
       expect(result1['hash3'].path).toBe('index.html'); // index.html should remain unchanged

       // Case 2: Trailing slash should be removed
       const result2 = applyBaseHrefToAssets(mockAssets, 'assets/');
       expect(result2['hash1'].path).toBe('assets/js/main.js');
       expect(result2['hash2'].path).toBe('assets/css/styles.css');

       // Case 3: Both leading and trailing slashes should be removed
       const result3 = applyBaseHrefToAssets(mockAssets, '/base/path/');
       expect(result3['hash1'].path).toBe('base/path/js/main.js');

       // Case 4: Empty or root path should not modify
       const result4 = applyBaseHrefToAssets(mockAssets, '/');
       expect(result4['hash1'].path).toBe('js/main.js');

       // Case 5: Absolute paths in assets should not be modified
       const mockAssetsWithAbsPath: ZeBuildAssetsMap = {
         hash4: { path: '/absolute/path.js', hash: 'hash4', size: 100, buffer: Buffer.from('content') },
       };
       const result5 = applyBaseHrefToAssets(mockAssetsWithAbsPath, 'base');
       expect(result5['hash4'].path).toBe('/absolute/path.js');
     });
   });
   ```

2. Test asset path transformation with different baseHref values
3. Test the full upload process with baseHref
4. Verify that uploaded assets have the correct paths, this verification should include running the builds with `DEBUG=zephyr:*` in front of the build commands to verify the assets hashmap being uploaded has the correct paths.

### Testing Examples:

For the rspack example:

```bash
cd examples/rspack-base-href
DEBUG=zephyr:* npm run build
```

For the vite example:

```bash
cd examples/basehref-example/vite-app
DEBUG=zephyr:* npm run build
```

For the webpack example:

```bash
cd examples/basehref-example/webpack-app
DEBUG=zephyr:* npm run build -- --env publicPath=/assets/
```

## Recommendations

1. When implementing baseHref, normalize the value to ensure consistent handling:

   - If it doesn't start with '/', add it
   - If it ends with '/', remove it
   - This will ensure "/u", "u/", and "/u/" all work consistently

2. Consider edge cases like:

   - Empty baseHref (should be treated as no baseHref)
   - Root baseHref ("/") should not modify paths
   - Double slashes should be prevented (e.g., "/u/" + "/file.js" → "/u/file.js")

3. Ensure backward compatibility with existing deployments

4. Add appropriate logging to help debug baseHref-related issues

## Clarifications

1. This implementation only affects the paths to which Zephyr uploads the files, not the runtime code generation or the output files generated by bundlers.

2. The implementation does not need to consider nested baseHref values (e.g., when a micro-frontend with its own baseHref is loaded by a host with a different baseHref).

3. No special handling is needed for absolute URLs in assets at this time.

4. There are no existing implementations of baseHref functionality in any of the Zephyr plugins to reference.

5. Special handling for CDN URLs versus relative paths is not required at this time.

## Implementation Summary

The baseHref implementation follows these core principles:

1. **Detection**: Each bundler plugin detects the baseHref value from its configuration:

   - rspack/webpack: From plugin options, HTML plugin's base.href, or output.publicPath
   - vite: From the vite.config.ts base property
   - rollup/rolldown: From options.base or fallback to directory structure

2. **Storage**: The detected baseHref is stored in the ZephyrEngine instance:

   - All plugins store the value in `zephyr_engine.buildProperties.baseHref`
   - This ensures the baseHref is available throughout the build process

3. **Application**: The baseHref is applied to assets during upload:

   - All assets except index.html have baseHref prepended to their path
   - The `applyBaseHrefToAssets` function handles path normalization
   - Special cases (absolute paths, URLs) are preserved

4. **Normalization**: The baseHref is normalized for consistency:

   - Leading/trailing slashes are removed
   - Special values ('/', './', '', '.') are treated as empty
   - This ensures '/u', 'u/', and '/u/' all produce the same result

5. **Index Handling**: index.html files are kept at the root:
   - This maintains the expected behavior for HTML entrypoints
   - Other assets are properly placed in the baseHref subdirectory

This implementation ensures consistent baseHref behavior across all supported build tools while maintaining backward compatibility with existing deployments.
