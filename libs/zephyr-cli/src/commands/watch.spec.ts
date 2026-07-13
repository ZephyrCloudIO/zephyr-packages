import { describe, expect, it } from '@rstest/core';
import { watchCommand } from './watch';

describe('watchCommand', () => {
  it('fails before touching the filesystem unless the development target is tap-app', async () => {
    await expect(
      watchCommand({
        directory: '/does-not-matter-for-target-validation',
        target: 'web',
        cwd: process.cwd(),
      })
    ).rejects.toThrow('requires --target tap-app');
  });

  it('requires the TAP metadata sidecar before opening a watcher', async () => {
    await expect(
      watchCommand({
        directory: '.',
        target: 'tap-app',
        cwd: process.cwd(),
      })
    ).rejects.toThrow('requires --metadata');
  });
});
