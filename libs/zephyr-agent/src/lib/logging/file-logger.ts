/**
 * File-based logging system that writes logs to ~/.zephyr/logs/ Each build run gets its
 * own directory with separate log files per type
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripAnsi } from 'zephyr-edge-contract';
import { ZE_PATH } from '../node-persist/storage-keys';

let currentRunDir: string | null = null;
let runStartTime: number | null = null;

type LogFormat = 'json' | 'toon';

export interface StructuredLogData {
  level: 'info' | 'warn' | 'error' | 'debug';
  action?: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Get the base log directory path Checks ZEPHYR_LOG_PATH env var, defaults to
 * ~/.zephyr/logs/
 */
export function getLogBasePath(): string {
  const customPath = process.env['ZEPHYR_LOG_PATH'];
  if (customPath) {
    return resolve(customPath);
  }
  return join(ZE_PATH, 'logs');
}

/** Initialize a new log run directory Called once per build */
export function initializeLogRun(): string {
  if (!runStartTime) {
    runStartTime = Date.now();
  }

  if (!currentRunDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const runId = `run-${timestamp}`;
    const logBasePath = getLogBasePath();
    currentRunDir = join(logBasePath, runId);

    try {
      mkdirSync(currentRunDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create log directory: ${error}`);
    }
  }

  return currentRunDir;
}

/** Get the current run directory */
export function getCurrentRunDir(): string | null {
  return currentRunDir;
}

/** Reset the run directory (for testing or new builds) */
export function resetLogRun(): void {
  currentRunDir = null;
  runStartTime = null;
}

/** Extract and parse JSON from message if present */
function extractStructuredData(message: string): { message: string; payload?: unknown } {
  // Find all JSON objects in the message
  const jsonRegex = /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g;
  const matches = message.match(jsonRegex);

  if (matches && matches.length > 0) {
    // Try to parse each match
    const parsed: unknown[] = [];
    let allValid = true;

    for (const match of matches) {
      try {
        parsed.push(JSON.parse(match));
      } catch {
        allValid = false;
        break;
      }
    }

    if (allValid && parsed.length > 0) {
      // Remove JSON objects from message
      let cleanMessage = message.replace(jsonRegex, '').trim();
      // Clean up extra whitespace and newlines
      cleanMessage = cleanMessage.replace(/\s+/g, ' ').trim();
      // Remove trailing colons and "Response:" "Options:" labels
      cleanMessage = cleanMessage
        .replace(/\s*(Response|Options|Payload|Data):\s*/gi, ' ')
        .trim();

      if (!cleanMessage) {
        cleanMessage = 'Structured data';
      }

      // If single object, return it directly, otherwise return array
      const payload = parsed.length === 1 ? parsed[0] : parsed;
      return { message: cleanMessage, payload };
    }
  }

  return { message };
}

/** Write a log entry to the appropriate file */
export function writeLogToFile(logData: StructuredLogData): void {
  const runDir = initializeLogRun();
  const format = getLogFormat();
  const extension = format === 'toon' ? 'toon' : 'log';

  // Determine the filename based on log level and action
  let filename: string;

  if (logData.action?.startsWith('debug:')) {
    // Debug logs go to debug-<context>.[toon|log]
    const context = logData.action.replace('debug:', '');
    filename = `debug-${context}.${extension}`;
  } else if (logData.action) {
    // Action-specific logs go to action-<name>.[toon|log]
    const actionName = logData.action.replace(/:/g, '-');
    filename = `action-${actionName}.${extension}`;
  } else {
    // Level-based logs go to <level>.[toon|log]
    filename = `${logData.level}.${extension}`;
  }

  const logFilePath = join(runDir, filename);

  // Clean message (remove ANSI codes)
  const cleanMsg = stripAnsi(logData.message);
  const { message, payload } = extractStructuredData(cleanMsg);

  const logEntry: Record<string, unknown> = {
    level: logData.level,
    message,
    timestamp: logData.timestamp || Date.now(),
  };

  if (logData.action) {
    logEntry['action'] = logData.action;
  }
  if (payload) {
    logEntry['payload'] = payload;
  }
  if (logData.data) {
    logEntry['data'] = logData.data;
  }

  let logLine: string;
  if (format === 'toon') {
    // TOON format - encode the object and add newline
    // Dynamic import to avoid issues with ESM-only package in tests due to Jest not supporting ESM.
    const { encode } = require('@toon-format/toon');
    logLine = encode(logEntry) + '\n';
  } else {
    // JSON format - one object per line
    logLine = JSON.stringify(logEntry) + '\n';
  }

  try {
    appendFileSync(logFilePath, logLine, 'utf8');
  } catch (error) {
    // Fail silently to avoid disrupting the build
    console.error(`Failed to write to log file: ${error}`);
  }
}

/** Write a summary file with metadata about the run */
export function writeRunSummary(data: {
  buildId?: string;
  applicationUid?: string;
  duration?: number;
  success: boolean;
  errorCount?: number;
  warnCount?: number;
}): void {
  const runDir = getCurrentRunDir();
  if (!runDir) return;

  const summaryPath = join(runDir, 'summary.json');
  const summary = {
    ...data,
    startTime: runStartTime ? new Date(runStartTime).toISOString() : null,
    endTime: new Date().toISOString(),
    duration: data.duration || (runStartTime ? Date.now() - runStartTime : 0),
  };

  try {
    appendFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  } catch (error) {
    console.error(`Failed to write summary file: ${error}`);
  }
}

/** Check if file logging is enabled */
export function isFileLoggingEnabled(): boolean {
  return (
    process.env['ZEPHYR_LOG_TO_FILE'] === 'true' ||
    process.env['ZEPHYR_LOG_TO_FILE'] === '1'
  );
}

/** Get the log file format (json or toon) */
export function getLogFormat(): LogFormat {
  const format = process.env['ZEPHYR_LOG_FORMAT'];
  return format === 'toon' ? 'toon' : 'json';
}
