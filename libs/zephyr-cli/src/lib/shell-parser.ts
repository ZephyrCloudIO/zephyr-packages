import { ZeErrors, ZephyrError } from 'zephyr-agent';

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
 *
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
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: 'Empty command line',
    });
  }

  // Split by whitespace while respecting quotes
  const tokens = tokenizeCommand(trimmed);

  if (tokens.length === 0) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Failed to parse command: ${commandLine}`,
    });
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
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Failed to parse command: ${commandLine}\nNo command found after environment variables`,
    });
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
 * Split a command line into multiple commands based on shell operators (;, &&) Respects
 * quotes and escapes.
 *
 * @example
 *   splitCommands('npm run build && npm run test');
 *   // Returns: ['npm run build', 'npm run test']
 *
 * @example
 *   splitCommands('echo "hello; world" && npm run build');
 *   // Returns: ['echo "hello; world"', 'npm run build']
 */
export function splitCommands(commandLine: string): string[] {
  const commands: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i];
    const nextChar = i + 1 < commandLine.length ? commandLine[i + 1] : '';

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    // Check for shell operators outside quotes
    if (!inSingleQuote && !inDoubleQuote) {
      // Check for &&
      if (char === '&' && nextChar === '&') {
        const trimmed = current.trim();
        if (trimmed) {
          commands.push(trimmed);
        }
        current = '';
        i++; // Skip the next &
        continue;
      }

      // Check for ;
      if (char === ';') {
        const trimmed = current.trim();
        if (trimmed) {
          commands.push(trimmed);
        }
        current = '';
        continue;
      }
    }

    current += char;
  }

  // Add the last command if any
  const trimmed = current.trim();
  if (trimmed) {
    commands.push(trimmed);
  }

  if (inSingleQuote || inDoubleQuote) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: 'Unmatched quote in command line',
    });
  }

  return commands;
}

/** Tokenize a command line string, respecting quotes and escapes */
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
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: 'Unmatched quote in command line',
    });
  }

  return tokens;
}
