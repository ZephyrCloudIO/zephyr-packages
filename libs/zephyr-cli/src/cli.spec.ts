import { describe, expect, it } from '@rstest/core';
import { parseArgs } from './cli';

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
