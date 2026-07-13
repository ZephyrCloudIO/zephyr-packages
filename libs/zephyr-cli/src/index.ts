#!/usr/bin/env node

import { cwd } from 'node:process';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import { parseArgs } from './cli';
import { deployCommand } from './commands/deploy';
import { runCommand } from './commands/run';
import { watchCommand } from './commands/watch';

async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    // Get current working directory
    const workingDir = cwd();

    // Dispatch to the appropriate command
    if (options.command === 'deploy' || options.command === 'watch') {
      if (!options.directory) {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: 'Directory is required for deploy command',
        });
      }

      if (options.command === 'deploy') {
        await deployCommand({
          directory: options.directory,
          target: options.target,
          verbose: options.verbose,
          ssr: options.ssr,
          metadataPath: options.metadataPath,
          cwd: workingDir,
        });
      } else {
        await watchCommand({
          directory: options.directory,
          target: options.target,
          verbose: options.verbose,
          ssr: options.ssr,
          debounceMs: options.debounceMs,
          metadataPath: options.metadataPath,
          cwd: workingDir,
        });
      }
    } else if (options.command === 'run') {
      if (!options.commandLine) {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: 'Command line is required for run command',
        });
      }

      await runCommand({
        commandLine: options.commandLine,
        target: options.target,
        verbose: options.verbose,
        ssr: options.ssr,
        metadataPath: options.metadataPath,
        cwd: workingDir,
      });
    }
  } catch (error) {
    console.error('[ze-cli] Error:', ZephyrError.format(error));
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error('[ze-cli] Fatal error:', ZephyrError.format(error));
  process.exit(1);
});
