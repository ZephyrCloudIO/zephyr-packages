#!/usr/bin/env node

import { cwd } from 'node:process';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import { isJsonDeploy, parseArgs } from './cli';
import { deployCommand } from './commands/deploy';
import { doctorCommand } from './commands/doctor';
import { runCommand } from './commands/run';
import { watchCommand } from './commands/watch';
import { createFailureDocument } from './lib/failure-document';
import { reserveStdout } from './lib/stdout';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // Keep stdout to the one JSON document; logs and login prompts go to stderr.
  const writeJson = isJsonDeploy(args) ? reserveStdout() : undefined;
  try {
    // Parse command line arguments
    const options = parseArgs(args);

    // Get current working directory
    const workingDir = cwd();

    // Dispatch to the appropriate command
    if (options.command === 'doctor') {
      const exitCode = await doctorCommand({
        directory: options.directory ?? '.',
        format: options.format ?? 'text',
        online: options.online,
        timeoutMs: options.timeoutMs,
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
        const result = await deployCommand({
          directory: options.directory,
          target: options.target,
          verbose: options.verbose,
          ssr: options.ssr,
          metadataPath: options.metadataPath,
          cwd: workingDir,
        });
        await writeJson?.(`${JSON.stringify(result)}\n`);
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
    // The document goes after the logs, so stdout holds exactly one JSON document.
    await writeJson?.(`${JSON.stringify(createFailureDocument(error))}\n`);
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error('[ze-cli] Fatal error:', ZephyrError.format(error));
  process.exit(1);
});
