import { parse } from 'sh-syntax';

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
 *   parseShellCommand('NODE_ENV=production webpack --mode production');
 *   // Returns: { command: 'webpack', envVars: { NODE_ENV: 'production' }, args: ['--mode', 'production'] }
 *
 * @example
 *   parseShellCommand('pnpm build');
 *   // Returns: { command: 'pnpm', envVars: {}, args: ['build'] }
 */
export async function parseShellCommand(
  commandLine: string
): Promise<ParsedCommand> {
  const envVars: Record<string, string> = {};
  let command = '';
  const args: string[] = [];

  // Use sh-syntax for robust parsing
  const file = await parse(commandLine);

  if (!file.Stmts || file.Stmts.length === 0) {
    throw new Error(
      `Failed to parse command: ${commandLine}\nNo statements found in parsed AST`
    );
  }

  const firstStmt = file.Stmts[0];
  const cmd = firstStmt.Cmd as any;

  // Check if this is a CallExpr (simple command)
  if (!cmd || !cmd.Args) {
    throw new Error(
      `Failed to parse command: ${commandLine}\nUnsupported command structure`
    );
  }

  // Look for assignments (environment variables)
  if (cmd.Assigns && cmd.Assigns.length > 0) {
    for (const assign of cmd.Assigns) {
      if (assign.Name && assign.Value) {
        const name = (assign.Name as any).Value || '';
        const value = extractWordValue(assign.Value);
        if (name) {
          envVars[name] = value;
        }
      }
    }
  }

  // Extract command and arguments
  if (cmd.Args && cmd.Args.length > 0) {
    command = extractWordValue(cmd.Args[0]);
    for (let i = 1; i < cmd.Args.length; i++) {
      args.push(extractWordValue(cmd.Args[i]));
    }
  }

  if (!command) {
    throw new Error(
      `Failed to parse command: ${commandLine}\nCould not extract command name`
    );
  }

  return {
    command,
    envVars,
    args,
    fullCommand: commandLine,
  };
}

/**
 * Helper function to extract text value from a Word node
 */
function extractWordValue(word: any): string {
  if (!word) return '';

  // If it has a Lit property, use that
  if (word.Lit) return word.Lit;

  // If it has Parts, concatenate them
  if (word.Parts && word.Parts.length > 0) {
    return word.Parts.map((part: any) => {
      if (part.Value) return part.Value;
      if (part.Lit) return part.Lit;
      return '';
    }).join('');
  }

  return '';
}
