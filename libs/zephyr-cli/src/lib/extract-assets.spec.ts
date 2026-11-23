// BDD description (unit tests are generated from this description):
//
// Feature: directory asset selection
//
//   Scenario: TAP packages keep their opaque files
//     Given a tap-app output with .map, .DS_Store, node_modules and .git files
//     Then every file is retained, while generic web output stays filtered
//
//   Scenario: a TAP package with a credential file is refused
//     Given a tap-app output holding .env, or a symlink to .env or out of the folder
//     Then the call throws and names the file
//
//   Scenario: symlinks cannot smuggle files out of the upload root
//     Given a symlink to ../.env, a symlinked folder outside the root, and a symlink
//       inside the root to an ordinary file or to .env
//     Then the outside ones are excluded as outside-root, the one to .env as denylist,
//       and the one to the ordinary file is kept
//     And a dangling symlink is ignored without failing
//
//   Scenario: an MPEG-TS video segment named .ts is uploaded
//     Given seg.ts starting with the 0x47 sync byte, and main.ts holding source text
//     Then the segment is selected and the source is refused
//
//   Scenario: secrets are never uploaded in legacy mode
//     Given .env, .dev.vars and a key file next to normal files, without include
//     Then only the normal files are selected and the secrets are reported as excluded
//
//   Scenario: include and exclude from a config
//     Given include **/* and a .map file
//     Then the .map file is uploaded, while .env, .git and node_modules still are not
//
//   Scenario: refusals apply to the dry-run selection too
//     Given TypeScript source files, or a Wrangler config without a config
//     Then selectDirectoryFiles throws
//
//   Scenario: exceptional input
//     Given a directory that does not exist
//     Then no files are returned for a web target
import { afterEach, describe, expect, it } from '@rstest/core';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractAssetsFromDirectory, selectDirectoryFiles } from './extract-assets';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('extractAssetsFromDirectory', () => {
  it('retains every opaque file for a TAP package while generic web output stays filtered', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zephyr-cli-tap-'));
    temporaryDirectories.push(directory);
    await Promise.all([
      mkdir(join(directory, 'node_modules', 'locked'), { recursive: true }),
      mkdir(join(directory, '.git'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(directory, 'manifest.tap.json'), '{"package":"example"}'),
      writeFile(join(directory, 'targets.mjs.map'), 'source-map'),
      writeFile(
        join(directory, 'node_modules', 'locked', 'asset.bin'),
        Buffer.from([0, 255])
      ),
      writeFile(join(directory, '.git', 'opaque-lock'), 'opaque'),
      writeFile(join(directory, '.DS_Store'), 'locked'),
    ]);

    const tapPaths = Object.values(
      await extractAssetsFromDirectory(directory, { target: 'tap-app' })
    ).map((asset) => asset.path);
    const webPaths = Object.values(await extractAssetsFromDirectory(directory)).map(
      (asset) => asset.path
    );

    expect(tapPaths).toEqual(
      expect.arrayContaining([
        'manifest.tap.json',
        'targets.mjs.map',
        'node_modules/locked/asset.bin',
        '.git/opaque-lock',
        '.DS_Store',
      ])
    );
    expect(webPaths).toEqual(['manifest.tap.json']);
  });

  async function makeDirectory(files: Record<string, string>): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'zephyr-cli-select-'));
    temporaryDirectories.push(directory);
    for (const [name, content] of Object.entries(files)) {
      await mkdir(join(directory, name, '..'), { recursive: true });
      await writeFile(join(directory, name), content);
    }
    return directory;
  }

  it('refuses a TAP package that contains a credential file', async () => {
    const withEnv = await makeDirectory({ 'a.js': 'x', '.env': 'S=1' });
    await expect(
      extractAssetsFromDirectory(withEnv, { target: 'tap-app' })
    ).rejects.toThrow(/\.env/);
  });

  it('refuses a TAP package with a symlink that leaves the folder or points to .env', async () => {
    const outside = await makeDirectory({ 'target.txt': 'x' });
    const leaving = await makeDirectory({ 'a.js': 'x' });
    await symlink(join(outside, 'target.txt'), join(leaving, 'link.txt'));
    await expect(
      extractAssetsFromDirectory(leaving, { target: 'tap-app' })
    ).rejects.toThrow(/link\.txt.*outside/);

    const toEnv = await makeDirectory({ 'a.js': 'x', '.env': 'S=1' });
    await rm(join(toEnv, 'a.js'));
    await symlink('.env', join(toEnv, 'config.txt'));
    await expect(
      extractAssetsFromDirectory(toEnv, { target: 'tap-app' })
    ).rejects.toThrow(/never-upload rule/);
  });

  it('never selects secrets in legacy mode', async () => {
    const directory = await makeDirectory({
      'index.js': 'x',
      '.env': 'S=1',
      '.dev.vars': 'S=1',
      'tls/server.key': 'k',
    });
    const { files, excluded } = await selectDirectoryFiles(directory);
    expect(files.map((f) => f.path)).toEqual(['index.js']);
    expect(excluded.map((e) => e.reason)).toEqual(['denylist', 'denylist', 'denylist']);
  });

  it('uploads .map files when included, but still no secrets', async () => {
    const directory = await makeDirectory({
      'index.js': 'x',
      'index.js.map': 'm',
      '.env': 'S=1',
      '.git/HEAD': 'ref',
      'node_modules/a/b.js': 'x',
    });
    const { files } = await selectDirectoryFiles(directory, { include: ['**/*'] });
    expect(files.map((f) => f.path).sort()).toEqual(['index.js', 'index.js.map']);
    expect(files.find((f) => f.path === 'index.js')?.size).toBe(1);
  });

  it('refuses TypeScript source and unconfigured Wrangler configs', async () => {
    const source = await makeDirectory({ 'index.js': 'x', 'main.ts': 'x' });
    await expect(selectDirectoryFiles(source)).rejects.toThrow(/TypeScript source/);
    const worker = await makeDirectory({ 'index.js': 'x', 'wrangler.toml': 'name="x"' });
    await expect(
      selectDirectoryFiles(worker, { workerConfigGuard: { hasConfig: false } })
    ).rejects.toThrow(/wrangler\.toml/);
    const { files, excluded } = await selectDirectoryFiles(worker, {
      include: ['**/*'],
      workerConfigGuard: { hasConfig: true },
    });
    expect(files.map((f) => f.path)).toEqual(['index.js']);
    expect(excluded).toEqual([
      { path: 'wrangler.toml', reason: 'denylist', rule: 'wrangler.toml' },
    ]);
  });

  describe('symlinks', () => {
    it('excludes a symlink to a file outside the root', async () => {
      const parent = await makeDirectory({ 'root/index.js': 'x', '.env': 'S=1' });
      await symlink(join(parent, '.env'), join(parent, 'root', 'config.txt'));
      const { files, excluded } = await selectDirectoryFiles(join(parent, 'root'), {
        include: ['**/*'],
      });
      expect(files.map((f) => f.path)).toEqual(['index.js']);
      expect(excluded).toEqual([
        { path: 'config.txt', reason: 'outside-root', rule: 'symlink' },
      ]);
    });

    it('excludes every file of a symlinked folder outside the root', async () => {
      const parent = await makeDirectory({
        'root/index.js': 'x',
        'home/id_rsa': 'k',
        'home/notes.txt': 'n',
      });
      await symlink(join(parent, 'home'), join(parent, 'root', 'assets'));
      const { files, excluded } = await selectDirectoryFiles(join(parent, 'root'), {
        include: ['**/*'],
      });
      expect(files.map((f) => f.path)).toEqual(['index.js']);
      expect(excluded.map((e) => [e.path, e.reason]).sort()).toEqual([
        ['assets/id_rsa', 'outside-root'],
        ['assets/notes.txt', 'outside-root'],
      ]);
    });

    it('keeps a symlink to an ordinary file inside the root', async () => {
      const directory = await makeDirectory({ 'real/ok.js': 'abc' });
      await symlink(join(directory, 'real', 'ok.js'), join(directory, 'alias.js'));
      const { files } = await selectDirectoryFiles(directory, { include: ['**/*'] });
      expect(files.map((f) => f.path).sort()).toEqual(['alias.js', 'real/ok.js']);
    });

    it('judges a symlink inside the root by its real target', async () => {
      const directory = await makeDirectory({ 'index.js': 'x', '.env': 'S=1' });
      await symlink('.env', join(directory, 'config.txt'));
      const { files, excluded } = await selectDirectoryFiles(directory, {
        include: ['**/*'],
      });
      expect(files.map((f) => f.path)).toEqual(['index.js']);
      expect(excluded.map((e) => [e.path, e.reason]).sort()).toEqual([
        ['.env', 'denylist'],
        ['config.txt', 'denylist'],
      ]);
    });

    it('ignores a dangling symlink', async () => {
      const directory = await makeDirectory({ 'index.js': 'x' });
      await symlink(join(directory, 'missing'), join(directory, 'dangling.js'));
      const { files } = await selectDirectoryFiles(directory, { include: ['**/*'] });
      expect(files.map((f) => f.path)).toEqual(['index.js']);
    });
  });

  it('uploads an MPEG-TS segment named .ts but refuses TypeScript source', async () => {
    const directory = await makeDirectory({ 'index.html': 'x' });
    await writeFile(join(directory, 'seg0.ts'), Buffer.from([0x47, 0x40, 0x00, 0x10]));
    const { files } = await selectDirectoryFiles(directory);
    expect(files.map((f) => f.path).sort()).toEqual(['index.html', 'seg0.ts']);

    await writeFile(join(directory, 'main.ts'), 'const a = 1;');
    await expect(selectDirectoryFiles(directory)).rejects.toThrow(/main\.ts/);
  });

  it('returns nothing for a directory that does not exist', async () => {
    const result = await selectDirectoryFiles(
      join(tmpdir(), 'zephyr-cli-does-not-exist')
    );
    expect(result.files).toEqual([]);
  });
});
