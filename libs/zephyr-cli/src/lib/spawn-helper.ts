import { spawn } from 'node:child_process';
import type { ParsedCommand } from './shell-parser';

export interface SpawnResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
}

/**
 * Execute a command with full stdio passthrough. All stdin, stdout, and stderr are
 * proxied between the parent and child process.
 *
 * @param parsed - The parsed command to execute
 * @param cwd - The working directory
 * @returns Promise that resolves with exit code and signal
 */
export async function executeCommand(
  parsed: ParsedCommand,
  cwd: string
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const { command, args, envVars } = parsed;

    // Merge environment variables
    const env = {
      ...process.env,
      ...envVars,
    };

    // Spawn the command
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit', // This passes stdin, stdout, and stderr through
      shell: true, // Use shell to handle complex commands
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code, signal) => {
      resolve({
        exitCode: code ?? 1,
        signal,
      });
    });
  });
}
