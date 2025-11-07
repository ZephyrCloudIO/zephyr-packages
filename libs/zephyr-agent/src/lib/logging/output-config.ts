/**
 * Output configuration management for structured logging
 * Supports both environment variables and programmatic configuration
 */

export type OutputFormat = 'plain' | 'json';

let outputFormat: OutputFormat | null = null;

/**
 * Get the current output format
 * Priority:
 * 1. Programmatically set format
 * 2. ZEPHYR_OUTPUT_FORMAT environment variable
 * 3. ZEPHYR_STRUCTURED_OUTPUT environment variable (legacy)
 * 4. Default to 'plain'
 */
export function getOutputFormat(): OutputFormat {
  if (outputFormat) {
    return outputFormat;
  }

  // Check ZEPHYR_OUTPUT_FORMAT first
  const envFormat = process.env['ZEPHYR_OUTPUT_FORMAT']?.toLowerCase();
  if (envFormat === 'json' || envFormat === 'plain') {
    return envFormat;
  }

  // Legacy support: ZEPHYR_STRUCTURED_OUTPUT=true means json
  const structuredOutput = process.env['ZEPHYR_STRUCTURED_OUTPUT']?.toLowerCase();
  if (structuredOutput === 'true' || structuredOutput === '1') {
    return 'json';
  }

  return 'plain';
}

/**
 * Set the output format programmatically
 * Useful for CLI flags like --output-format
 */
export function setOutputFormat(format: OutputFormat): void {
  outputFormat = format;
}

/**
 * Check if structured output (JSON) is enabled
 */
export function isStructuredOutput(): boolean {
  return getOutputFormat() === 'json';
}

/**
 * Check if colors should be used in output
 * Colors are disabled for JSON output and when NO_COLOR is set
 */
export function shouldUseColors(): boolean {
  if (isStructuredOutput()) {
    return false;
  }

  // Respect NO_COLOR environment variable
  if (process.env['NO_COLOR']) {
    return false;
  }

  return true;
}
