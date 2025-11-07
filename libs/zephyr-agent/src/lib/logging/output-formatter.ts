/**
 * Output formatter for structured and plain text logging
 */

import { stripAnsi } from 'zephyr-edge-contract';
import { getOutputFormat } from './output-config';

export interface StructuredLogData {
  level: 'info' | 'warn' | 'error' | 'debug';
  action?: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Format output based on the current output mode
 * Returns formatted string ready for console output
 */
export function formatOutput(data: StructuredLogData, plainTextMessage?: string): string {
  const format = getOutputFormat();

  if (format === 'json') {
    return formatAsJson(data);
  }

  // For plain text, use the pre-formatted message if provided,
  // otherwise use the raw message
  return plainTextMessage ?? data.message;
}

/**
 * Format data as JSON for structured output
 */
function formatAsJson(data: StructuredLogData): string {
  const output: StructuredLogData = {
    level: data.level,
    message: stripAnsi(data.message),
    timestamp: data.timestamp ?? Date.now(),
  };

  if (data.action) {
    output.action = data.action;
  }

  if (data.data) {
    output.data = data.data;
  }

  return JSON.stringify(output);
}

/**
 * Clean a message by removing ANSI codes
 * Useful for preparing messages for JSON output
 */
export function cleanMessage(message: string): string {
  return stripAnsi(message);
}

/**
 * Create a structured log data object from simple parameters
 */
export function createLogData(
  level: StructuredLogData['level'],
  message: string,
  action?: string,
  data?: Record<string, unknown>
): StructuredLogData {
  return {
    level,
    message,
    action,
    data,
    timestamp: Date.now(),
  };
}
