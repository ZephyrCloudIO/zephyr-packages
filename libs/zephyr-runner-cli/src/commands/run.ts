import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ZephyrEngine, logFn, ZephyrError, ZeErrors } from 'zephyr-agent';
import { detectCommand } from '../lib/command-detector';
import { extractAssetsFromDirectory } from '../lib/extract-assets';
import { parseShellCommand } from '../lib/shell-parser';
import { executeCommand } from '../lib/spawn-helper';
import { uploadAssets } from '../lib/upload';

export interface RunOptions {
  commandLine: string;
  target?: 'web' | 'ios' | 'android';
  verbose?: boolean;
  ssr?: boolean;
  cwd: string;
}

/**
 * Run command: Execute a build command and automatically upload the resulting assets.
 */
export async function runCommand(options: RunOptions): Promise<void> {
  const { commandLine, target, verbose, ssr, cwd } = options;

  // Log to stderr so it doesn't interfere with command output
  const log = (level: 'info' | 'warn' | 'error', message: string) => {
    if (level === 'info' && !verbose) {
      return;
    }
    // All ze-cli logs go to stderr
    console.error(`[ze-cli] ${message}`);
  };

  // Parse the shell command
  log('info', `Parsing command: ${commandLine}`);
  const parsed = parseShellCommand(commandLine);
  log('info', `Detected command: ${parsed.command}`);

  // Detect the build tool and configuration
  const detected = detectCommand(parsed, cwd);
  log('info', `Detected tool: ${detected.tool}`);

  if (detected.configFile) {
    log('info', `Config file: ${detected.configFile}`);
  }

  // Warn about dynamic configs
  if (detected.isDynamicConfig) {
    console.error('[ze-cli] WARNING: Configuration is too dynamic to analyze!');
    console.error('[ze-cli] ');
    console.error(
      '[ze-cli] Your build tool uses a JavaScript configuration file that cannot be'
    );
    console.error('[ze-cli] statically analyzed. This means ze-cli cannot automatically');
    console.error('[ze-cli] detect the output directory.');
    console.error('[ze-cli] ');
    console.error('[ze-cli] Recommendations:');
    console.error('[ze-cli] 1. Use a Zephyr bundler plugin:');
    console.error('[ze-cli]    - @zephyrcloud/webpack-plugin');
    console.error('[ze-cli]    - @zephyrcloud/rollup-plugin');
    console.error('[ze-cli]    - @zephyrcloud/vite-plugin');
    console.error('[ze-cli]    - etc.');
    console.error('[ze-cli] 2. Or use "ze-cli deploy <dir>" after building');
    console.error('[ze-cli] ');
    console.error(
      '[ze-cli] For more info: https://docs.zephyr-cloud.io/integrations'
    );
    console.error('[ze-cli] ');
  }

  // Display other warnings
  if (detected.warnings.length > 0 && !detected.isDynamicConfig) {
    for (const warning of detected.warnings) {
      console.error(`[ze-cli] Warning: ${warning}`);
    }
  }

  // Execute the build command
  log('info', 'Executing build command...');
  const result = await executeCommand(parsed, cwd);

  if (result.exitCode !== 0) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Build command failed with exit code ${result.exitCode}`,
    });
  }

  log('info', 'Build completed successfully');

  // If we couldn't detect the output directory, stop here
  if (!detected.outputDir) {
    console.error('[ze-cli] ');
    console.error(
      '[ze-cli] Could not detect output directory. Skipping upload.'
    );
    console.error(
      '[ze-cli] Please use "ze-cli deploy <dir>" to upload manually.'
    );
    console.error('[ze-cli] ');
    return;
  }

  // Resolve the output directory
  const outputDir = resolve(cwd, detected.outputDir);
  log('info', `Output directory: ${outputDir}`);

  // Check if output directory exists
  if (!existsSync(outputDir)) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Output directory does not exist: ${outputDir}`,
    });
  }

  // Initialize ZephyrEngine with project root context
  log('info', 'Initializing Zephyr Engine...');
  const zephyr_engine = await ZephyrEngine.create({
    builder: detected.tool as any,
    context: cwd,
  });

  // Set build target if specified
  if (target) {
    zephyr_engine.env.target = target;
  }

  // Set SSR flag if specified
  if (ssr) {
    zephyr_engine.env.ssr = true;
  }

  // Extract assets from the output directory
  log('info', 'Extracting assets from output directory...');
  const assetsMap = await extractAssetsFromDirectory(outputDir);

  const assetCount = Object.keys(assetsMap).length;
  log('info', `Found ${assetCount} assets to upload`);

  // Upload assets
  log('info', 'Uploading assets to Zephyr...');
  await uploadAssets({
    zephyr_engine,
    assetsMap,
  });

  log('info', 'Upload completed successfully');
}
