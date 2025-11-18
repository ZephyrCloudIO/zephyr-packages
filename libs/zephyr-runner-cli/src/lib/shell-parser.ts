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
 * Uses simple regex-based parsing to handle common cases like:
 * - `pnpm build`
 * - `NODE_ENV=production webpack --mode production`
 * - `KEY1=value1 KEY2=value2 command arg1 arg2`
 *
 * @example
 *   parseShellCommand('NODE_ENV=production webpack --mode production');
 *   // Returns: { command: 'webpack', envVars: { NODE_ENV: 'production' }, args: ['--mode', 'production'] }
 *
 * @example
 *   parseShellCommand('pnpm build');
 *   // Returns: { command: 'pnpm', envVars: {}, args: ['build'] }
 */
export function parseShellCommand(commandLine: string): ParsedCommand {
  const envVars: Record<string, string> = {};
  const trimmed = commandLine.trim();

  if (!trimmed) {
    throw new Error('Empty command line');
  }

  // Split by whitespace while respecting quotes
  const tokens = tokenizeCommand(trimmed);

  if (tokens.length === 0) {
    throw new Error(`Failed to parse command: ${commandLine}`);
  }

  let i = 0;

  // Extract environment variables (KEY=VALUE format at the beginning)
  while (i < tokens.length) {
    const token = tokens[i];
    const match = token.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (match) {
      const [, name, value] = match;
      envVars[name] = value;
      i++;
    } else {
      break;
    }
  }

  // The next token should be the command
  if (i >= tokens.length) {
    throw new Error(
      `Failed to parse command: ${commandLine}\nNo command found after environment variables`
    );
  }

  const command = tokens[i];
  i++;

  // Remaining tokens are arguments
  const args = tokens.slice(i);

  return {
    command,
    envVars,
    args,
    fullCommand: commandLine,
  };
}

/**
 * Tokenize a command line string, respecting quotes and escapes
 */
function tokenizeCommand(commandLine: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  if (inSingleQuote || inDoubleQuote) {
    throw new Error('Unmatched quote in command line');
  }

  return tokens;
}
