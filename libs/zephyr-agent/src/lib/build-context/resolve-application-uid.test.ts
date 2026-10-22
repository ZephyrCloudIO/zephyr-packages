import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolvePreflightApplicationUid } from './resolve-application-uid';

const directories: string[] = [];

async function project(files: Record<string, string>, origin?: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'ze-uid-'));
  directories.push(directory);
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(directory, name), content);
  }
  execFileSync('git', ['init', '--quiet'], { cwd: directory });
  if (origin)
    execFileSync('git', ['remote', 'add', 'origin', origin], { cwd: directory });
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('resolvePreflightApplicationUid', () => {
  it('builds the UID from the package name and the git remote', async () => {
    const directory = await project(
      { 'package.json': JSON.stringify({ name: 'host', version: '1.0.0' }) },
      'git@github.com:Example-Org/example-repo.git'
    );

    await expect(resolvePreflightApplicationUid(directory)).resolves.toEqual({
      uid: 'host.example-repo.example-org',
    });
  });

  it('prints nothing, so a JSON report on stdout stays valid', async () => {
    // No zephyr:dependencies field: the build helper would log a hint about it.
    const directory = await project(
      { 'package.json': JSON.stringify({ name: 'host', version: '1.0.0' }) },
      'git@github.com:example-org/example-repo.git'
    );
    const log = rs.spyOn(console, 'log').mockImplementation(() => undefined);
    const info = rs.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined);
    const write = rs.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      await resolvePreflightApplicationUid(directory);
      expect([
        log.mock.calls,
        info.mock.calls,
        warn.mock.calls,
        write.mock.calls,
      ]).toEqual([[], [], [], []]);
    } finally {
      rs.restoreAllMocks();
    }
  });

  it('says it cannot tell when there is no remote origin', async () => {
    const directory = await project({
      'package.json': JSON.stringify({ name: 'host', version: '1.0.0' }),
    });

    await expect(resolvePreflightApplicationUid(directory)).resolves.toEqual({
      reason: 'unresolved',
    });
  });

  it('does not run a zephyr.config file to find the name', async () => {
    const directory = await project(
      {
        'package.json': JSON.stringify({ name: 'host', version: '1.0.0' }),
        'zephyr.config.js': "require('node:fs').writeFileSync('ran.txt', 'x');\n",
      },
      'git@github.com:example-org/example-repo.git'
    );

    await expect(resolvePreflightApplicationUid(directory)).resolves.toEqual({
      reason: 'config-file',
    });
    expect(
      await import('node:fs').then(({ existsSync }) =>
        existsSync(path.join(directory, 'ran.txt'))
      )
    ).toBe(false);
  });
});
