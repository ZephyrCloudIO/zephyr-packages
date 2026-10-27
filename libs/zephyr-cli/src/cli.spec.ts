import { describe, expect, it } from '@rstest/core';
import { isJsonDeploy, parseArgs } from './cli';

describe('parseArgs build target', () => {
  it('accepts tap-app before a run command', () => {
    expect(parseArgs(['--target', 'tap-app', 'pnpm', 'build'])).toMatchObject({
      command: 'run',
      commandLine: 'pnpm build',
      target: 'tap-app',
    });
  });

  it('accepts tap-app after a deploy directory', () => {
    expect(parseArgs(['deploy', './dist', '--target', 'tap-app'])).toMatchObject({
      command: 'deploy',
      directory: './dist',
      target: 'tap-app',
    });
  });

  it('accepts a tap-app output watch with a debounce', () => {
    expect(
      parseArgs(['watch', './dist', '--target', 'tap-app', '--debounce', '500'])
    ).toMatchObject({
      command: 'watch',
      directory: './dist',
      target: 'tap-app',
      debounceMs: 500,
    });
  });

  it('accepts a metadata sidecar before a run command and after directory commands', () => {
    expect(
      parseArgs([
        '--target',
        'tap-app',
        '--metadata',
        './dist/zephyr-publication.json',
        'pnpm',
        'build',
      ])
    ).toMatchObject({
      command: 'run',
      commandLine: 'pnpm build',
      metadataPath: './dist/zephyr-publication.json',
    });
    expect(
      parseArgs([
        'watch',
        './dist',
        '--target',
        'tap-app',
        '--metadata',
        './dist/zephyr-publication.json',
      ])
    ).toMatchObject({
      command: 'watch',
      metadataPath: './dist/zephyr-publication.json',
    });
  });

  it('rejects a metadata flag without a sidecar path', () => {
    expect(() => parseArgs(['deploy', './dist', '--metadata'])).toThrow(
      '--metadata requires a JSON sidecar path'
    );
  });

  it('rejects an unsupported directory-command target instead of silently dropping it', () => {
    expect(() => parseArgs(['deploy', './dist', '--target', 'unknown-target'])).toThrow(
      'Unsupported Zephyr build target: unknown-target'
    );
  });

  it('rejects an unsupported leading target instead of silently defaulting to web', () => {
    expect(() => parseArgs(['--target', 'unknown-target', 'pnpm', 'build'])).toThrow(
      'Unsupported Zephyr build target: unknown-target'
    );
  });
});

describe('parseArgs doctor', () => {
  it('defaults to the current directory and text output', () => {
    expect(parseArgs(['doctor'])).toMatchObject({
      command: 'doctor',
      directory: '.',
      format: 'text',
    });
  });

  it('accepts an optional directory and JSON output', () => {
    expect(parseArgs(['doctor', './apps/host', '--format', 'json'])).toMatchObject({
      command: 'doctor',
      directory: './apps/host',
      format: 'json',
    });
  });

  it('rejects unsupported doctor formats and flags', () => {
    expect(() => parseArgs(['doctor', '--format', 'yaml'])).toThrow(
      '--format must be either json or text'
    );
    expect(() => parseArgs(['doctor', '--write'])).toThrow(
      'Unknown doctor option: --write'
    );
  });
});

describe('parseArgs doctor --online', () => {
  it('stays offline unless --online is given', () => {
    expect(parseArgs(['doctor'])).not.toHaveProperty('online');
    expect(parseArgs(['doctor'])).not.toHaveProperty('timeoutMs');
  });

  it('accepts --online with a directory, a format and a timeout', () => {
    expect(
      parseArgs(['doctor', './app', '--online', '--timeout', '2500', '--format', 'json'])
    ).toMatchObject({
      command: 'doctor',
      directory: './app',
      format: 'json',
      online: true,
      timeoutMs: 2500,
    });
  });

  it('rejects a timeout that is missing, not whole, or out of range', () => {
    for (const value of ['0', '-1', '1.5', 'abc', '60001']) {
      expect(() => parseArgs(['doctor', '--online', '--timeout', value])).toThrow(
        '--timeout must be an integer from 1 to 60000'
      );
    }
    expect(() => parseArgs(['doctor', '--online', '--timeout'])).toThrow(
      '--timeout must be an integer'
    );
  });

  it('rejects --timeout without --online', () => {
    expect(() => parseArgs(['doctor', '--timeout', '100'])).toThrow(
      '--timeout can only be used with --online'
    );
  });
});

describe('parseArgs deploy result format', () => {
  it('accepts a json result format for deploy', () => {
    expect(parseArgs(['deploy', './dist', '--format', 'json'])).toMatchObject({
      command: 'deploy',
      directory: './dist',
      format: 'json',
    });
    expect(() => parseArgs(['deploy', './dist', '--format', 'yaml'])).toThrow(
      '--format must be either json or text.'
    );
  });
});

describe('isJsonDeploy', () => {
  it('detects deploy with --format json, before or after other options', () => {
    expect(isJsonDeploy(['deploy', './dist', '--format', 'json'])).toBe(true);
    expect(
      isJsonDeploy(['--target', 'web', 'deploy', './dist', '--format', 'json'])
    ).toBe(true);
  });

  it('ignores other commands and text output', () => {
    expect(isJsonDeploy(['deploy', './dist'])).toBe(false);
    expect(isJsonDeploy(['deploy', 'd', '--format', 'json', '--format', 'text'])).toBe(
      false
    );
    expect(isJsonDeploy(['deploy', './dist', '--format', 'text'])).toBe(false);
    expect(isJsonDeploy(['doctor', '.', '--format', 'json'])).toBe(false);
    expect(isJsonDeploy(['npm', 'run', 'deploy', '--format', 'json'])).toBe(false);
  });
});
