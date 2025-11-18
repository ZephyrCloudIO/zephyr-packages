import { parseScript } from 'sh-syntax';

export interface ParsedCommand {
  /** The main command to execute (without environment variables) */
  command: string;
  /** Environment variables set for this command */
  envVars: Record<string, string>;
  /** Arguments passed to the command */
  args: string[];
  /** The full command line as a string */
  fullCommand: string;
}

/**
 * Parse a shell command to extract the actual command, args, and environment variables.
 * Uses sh-syntax for proper shell parsing.
 *
 * @example
 * parseShellCommand('NODE_ENV=production webpack --mode production')
 * // Returns: { command: 'webpack', envVars: { NODE_ENV: 'production' }, args: ['--mode', 'production'] }
 *
 * @example
 * parseShellCommand('pnpm build')
 * // Returns: { command: 'pnpm', envVars: {}, args: ['build'] }
 */
export function parseShellCommand(commandLine: string): ParsedCommand {
  const envVars: Record<string, string> = {};
  let command = '';
  const args: string[] = [];

  try {
    const ast = parseScript(commandLine);

    // Find the first command in the script
    if (ast.commands && ast.commands.length > 0) {
      const firstCommand = ast.commands[0];

      if (firstCommand.type === 'Command' && firstCommand.prefix) {
        // Extract environment variables from prefix
        for (const item of firstCommand.prefix) {
          if (item.type === 'AssignmentWord') {
            const match = item.text.match(/^([^=]+)=(.*)$/);
            if (match) {
              envVars[match[1]] = match[2];
            }
          }
        }
      }

      // Extract command name and arguments
      if (firstCommand.type === 'Command' && firstCommand.name) {
        command = firstCommand.name.text;

        if (firstCommand.suffix) {
          for (const item of firstCommand.suffix) {
            if (item.type === 'Word') {
              args.push(item.text);
            }
          }
        }
      }
    }
  } catch (error) {
    // If parsing fails, fall back to simple splitting
    // This handles cases where sh-syntax can't parse the command
    const parts = commandLine.trim().split(/\s+/);
    let foundCommand = false;

    for (const part of parts) {
      if (!foundCommand && part.includes('=')) {
        // This looks like an environment variable
        const [key, ...valueParts] = part.split('=');
        envVars[key] = valueParts.join('=');
      } else if (!foundCommand) {
        // First non-env part is the command
        command = part;
        foundCommand = true;
      } else {
        // Rest are arguments
        args.push(part);
      }
    }
  }

  return {
    command,
    envVars,
    args,
    fullCommand: commandLine,
  };
}
