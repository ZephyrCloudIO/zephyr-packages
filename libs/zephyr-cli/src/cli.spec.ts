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
});
