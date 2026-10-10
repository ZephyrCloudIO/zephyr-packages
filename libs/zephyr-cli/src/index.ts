#!/usr/bin/env node

import { cwd } from 'node:process';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import { parseArgs } from './cli';
import { deployCommand } from './commands/deploy';
import { doctorCommand } from './commands/doctor';
import { runCommand } from './commands/run';
import { watchCommand } from './commands/watch';
import { attributionCommand } from './commands/attribution';

function routeConsoleToStderr(): void {
  const toStderr = (...data: unknown[]) => console.error(...data);
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  console.warn = toStderr;
}

async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    if (args[0] === 'attribution') {
      attributionCommand(args.slice(1), cwd());
      return;
    }
    const options = parseArgs(args);

    // Get current working directory
    const workingDir = cwd();

    // Dispatch to the appropriate command
    if (options.command === 'doctor') {
      const exitCode = await doctorCommand({
        directory: options.directory ?? '.',
        format: options.format ?? 'text',
        cwd: workingDir,
      });
      process.exitCode = exitCode;
    } else if (options.command === 'deploy' || options.command === 'watch') {
      if (!options.directory) {
        throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
          message: 'Directory is required for deploy command',
        });
      }

      if (options.command === 'deploy') {
        const json = options.format === 'json';
        // Keep stdout to the one result line; Zephyr logs through console.log.
        if (json) routeConsoleToStderr();
        const result = await deployCommand({
          directory: options.directory,
          target: options.target,
          verbose: options.verbose,
          ssr: options.ssr,
          metadataPath: options.metadataPath,
          cwd: workingDir,
        });
        if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
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
