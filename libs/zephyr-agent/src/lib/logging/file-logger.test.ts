import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { getCurrentRunDir, resetLogRun, writeLogToFile } from './file-logger';

describe('file logger redaction', () => {
  let logRoot: string;

  beforeEach(() => {
    logRoot = mkdtempSync(join(tmpdir(), 'zephyr-log-redaction-'));
    process.env['ZEPHYR_LOG_PATH'] = logRoot;
    process.env['ZEPHYR_LOG_FORMAT'] = 'json';
    resetLogRun();
  });

  afterEach(() => {
    resetLogRun();
    delete process.env['ZEPHYR_LOG_PATH'];
    delete process.env['ZEPHYR_LOG_FORMAT'];
    rmSync(logRoot, { force: true, recursive: true });
  });

  it('never writes raw secret fields, URLs, or circular error values', () => {
    const signature = 'raw-file-signature';
    const token = 'raw-file-token';
    const error = new Error(
      `failed https://uploads.example/file?X-Amz-Signature=${signature}`
    ) as Error & { self?: unknown };
    error.self = error;

    writeLogToFile({
      level: 'error',
      action: 'request:failed',
      message: error.message,
      data: {
        Authorization: `Bearer ${token}`,
        error,
        status: 503,
      },
    });

    const runDirectory = getCurrentRunDir();
    expect(runDirectory).not.toBeNull();
    const output = readFileSync(
      join(runDirectory as string, 'action-request-failed.log'),
      'utf8'
    );

    expect(output).toContain('uploads.example/file');
    expect(output).toContain('503');
    expect(output).toContain('[Circular]');
    expect(output).not.toContain(signature);
    expect(output).not.toContain(token);
  });
});
