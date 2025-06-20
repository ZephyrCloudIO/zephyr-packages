/**
 * Logger utility for MCP server
 * All logging should go to stderr to avoid interfering with stdio JSON-RPC communication
 */

export const logger = {
  log: (...args: unknown[]) => {
    console.error('[INFO]', ...args);
  },
  
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
  },
  
  warn: (...args: unknown[]) => {
    console.error('[WARN]', ...args);
  },
  
  debug: (...args: unknown[]) => {
    if (process.env['DEBUG']) {
      console.error('[DEBUG]', ...args);
    }
  }
};