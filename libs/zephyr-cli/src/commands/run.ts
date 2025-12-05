import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ZeErrors, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import { detectMultipleCommands } from '../lib/command-detector';
import { extractAssetsFromDirectory } from '../lib/extract-assets';
import { parseShellCommand, splitCommands } from '../lib/shell-parser';
import { executeCommand } from '../lib/spawn-helper';
import { uploadAssets } from '../lib/upload';

export interface RunOptions {
  commandLine: string;
  target?: 'web' | 'ios' | 'android';
  verbose?: boolean;
  ssr?: boolean;
  cwd: string;
}

/** Run command: Execute a build command and automatically upload the resulting assets. */
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

  // Parse the shell command - check if there are multiple commands
  log('info', `Parsing command: ${commandLine}`);
  const individualCommands = splitCommands(commandLine);

  if (individualCommands.length > 1) {
    log('info', `Detected ${individualCommands.length} commands to execute`);
  }

  // Detect multiple commands and their output directories
  const multiDetection = await detectMultipleCommands(commandLine, cwd);
  const { commands: detectedCommands, outputDirs, commonOutputDir } = multiDetection;

  // Log detected tools
  // Flatten commands if there are sub-commands
  const allCommands: typeof detectedCommands = [];
  for (const detected of detectedCommands) {
    if (detected.subCommands && detected.subCommands.length > 0) {
      // If there are sub-commands, log them instead of the parent
      allCommands.push(...detected.subCommands);
    } else {
      allCommands.push(detected);
    }
  }

  for (let i = 0; i < allCommands.length; i++) {
    const detected = allCommands[i];
    log('info', `Command ${i + 1}: ${detected.tool}`);

    if (detected.configFile) {
      log('info', `  Config file: ${detected.configFile}`);
    }

    if (detected.outputDir) {
      const absoluteOutputDir = resolve(cwd, detected.outputDir);
      log('info', `  Output directory: ${relative(cwd, absoluteOutputDir) || '.'}`);
    }
  }

  // If multiple output directories detected, show common ancestor
  if (outputDirs.length > 1 && commonOutputDir) {
    log(
      'info',
      `Multiple output directories detected, using common ancestor: ${relative(cwd, commonOutputDir) || '.'}`
    );
  }

  // Warn about dynamic configs
  if (!outputDirs.length) {
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
    console.error('[ze-cli] For more info: https://docs.zephyr-cloud.io/integrations');
    console.error('[ze-cli] ');
  }

  // Display warnings from all commands
  for (const detected of detectedCommands) {
    if (detected.warnings.length > 0 && !detected.isDynamicConfig) {
      for (const warning of detected.warnings) {
        console.error(`[ze-cli] Warning: ${warning}`);
      }
    }
  }

  // Execute all build commands sequentially
  for (let i = 0; i < individualCommands.length; i++) {
    const cmd = individualCommands[i];
    log('info', `Executing command ${i + 1}/${individualCommands.length}: ${cmd}`);

    try {
      const parsed = parseShellCommand(cmd);
      const result = await executeCommand(parsed, cwd);

      if (result.exitCode !== 0) {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: `Build command failed with exit code ${result.exitCode}`,
        });
      }

      log('info', `Command ${i + 1} completed successfully`);
    } catch (error) {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: `Failed to execute command: ${cmd}\n${(error as Error).message}`,
      });
    }
  }

  log('info', 'All build commands completed successfully');

  // Determine which output directory to use
  let outputDir: string | null = null;

  if (commonOutputDir) {
    outputDir = commonOutputDir;
  } else if (detectedCommands.length === 1 && detectedCommands[0].outputDir) {
    outputDir = resolve(cwd, detectedCommands[0].outputDir);
  }

  // If we couldn't detect the output directory, stop here
  if (!outputDir) {
    console.error('[ze-cli] ');
    console.error('[ze-cli] Could not detect output directory. Skipping upload.');
    console.error('[ze-cli] Please use "ze-cli deploy <dir>" to upload manually.');
    console.error('[ze-cli] ');
    return;
  }

  log('info', `Using output directory: ${relative(cwd, outputDir) || '.'}`);

  // Check if output directory exists
  if (!existsSync(outputDir)) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Output directory does not exist: ${outputDir}`,
    });
  }

  // Determine the primary build tool for ZephyrEngine
  const primaryTool = detectedCommands[0]?.tool || 'unknown';

  // Initialize ZephyrEngine with project root context
  log('info', 'Initializing Zephyr Engine...');
  const zephyr_engine = await ZephyrEngine.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    builder: primaryTool as any,
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
