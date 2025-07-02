#!/usr/bin/env node

/**
 * Zephyr Next.js Post-Build Deployment Script
 *
 * This script runs after Next.js build completes to upload assets to Zephyr Cloud
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Zephyr Next.js Deployment: Starting post-build upload...');

  try {
    // Import the Zephyr adapter core functionality
    const {
      convertToZephyrAssets,
      createSnapshot,
      uploadSnapshot,
    } = require('../../dist/libs/zephyr-nextjs-adapter/src/lib/core.js');
    const {
      createLogger,
    } = require('../../dist/libs/zephyr-nextjs-adapter/src/lib/utils.js');

    const log = createLogger('post-build');

    // Simulate build context from Next.js standalone output
    const buildContext = await createBuildContextFromNextJSOutput();

    log.info(`📊 Found ${buildContext.outputs.length} Next.js outputs to process`);

    // Convert Next.js outputs to Zephyr format
    const zephyrAssets = await convertToZephyrAssets(buildContext, log);

    // Create snapshot
    const snapshot = await createSnapshot(zephyrAssets, buildContext, log);

    // Upload to Zephyr Cloud
    const result = await uploadSnapshot(snapshot, log);

    if (result.success) {
      log.info('✨ Zephyr deployment completed successfully!');
      log.info(`🔗 Build ID: ${result.buildId}`);
    } else {
      log.warn('⚠️  Deployment completed with warnings');
      if (result.errors) {
        result.errors.forEach((error) => log.warn(`   - ${error}`));
      }
    }
  } catch (error) {
    console.error('❌ Zephyr deployment failed:', error.message);
    process.exit(1);
  }
}

/** Create a mock build context from Next.js standalone output */
async function createBuildContextFromNextJSOutput() {
  const standaloneDir = path.join(process.cwd(), '.next/standalone');
  const staticDir = path.join(process.cwd(), '.next/static');

  const outputs = [];

  // Mock some Next.js outputs for demonstration
  if (fs.existsSync(standaloneDir)) {
    outputs.push({
      id: 'server-bundle',
      pathname: '/server.js',
      filePath: path.join(standaloneDir, 'server.js'),
      type: 'APP_PAGE',
      runtime: 'nodejs',
      assets: {},
    });
  }

  if (fs.existsSync(staticDir)) {
    const staticFiles = fs.readdirSync(staticDir, { recursive: true });
    staticFiles.forEach((file, index) => {
      if (typeof file === 'string') {
        outputs.push({
          id: `static-${index}`,
          pathname: `/_next/static/${file}`,
          filePath: path.join(staticDir, file),
          type: 'STATIC_FILE',
          assets: {},
        });
      }
    });
  }

  return {
    routes: {
      headers: [],
      redirects: [],
      rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
      dynamicRoutes: [],
    },
    outputs,
  };
}

if (require.main === module) {
  main();
}
