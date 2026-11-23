// BDD description (unit tests are generated from this description):
//
// Feature: ze-cli deploy with zephyr.config.json, flags and dry run
//
//   Scenario: dry run uploads nothing and needs no sign-in
//     Given an output folder with a config
//     When deploy runs with dryRun
//     Then it returns the file list and totals, and never creates a ZephyrEngine,
//       checks ZE_DISABLED or calls uploadAssets
//
//   Scenario: dry run equals upload
//     Given the same folder and config
//     Then the dry-run file paths equal the asset paths passed to uploadAssets
//
//   Scenario: flags override the config
//     Given a config that includes **/* and excludes **/*.css
//     When --include '*.css' and --exclude 'nothing' replace them
//     Then only the css file is selected
//
//   Scenario: no config keeps today's behavior
//     Given a folder with a .map file, a .env and no config
//     Then the upload skips the .map and the .env, and the hint is logged
//     But with format json the hint is not logged
//
//   Scenario: config details
//     Given a config with output and metadata, an explicit --config path
//     Then the root is the config folder plus output, and the config file is never listed
//     And an --exclude flag without any include is an error
//
//   Scenario: upload guards
//     Given a wrangler.toml and no config
//     Then dry run and upload both refuse, before any engine call
//     But with a config, the dry run succeeds and lists wrangler.toml as denylisted
//     And TypeScript source in the selection is refused
//
//   Scenario: nothing selected
//     Given an include list that matches no file
//     Then the real upload throws "Nothing to upload" before any engine exists
//     And the dry run returns the plan with nothingToUpload set, for a non-zero exit
//
//   Scenario: flags without a config
//     Given --include without a zephyr.config.json
//     Then the hint says that flags choose the files for this run only
//
//   Scenario: blocked files are reported
//     Given a .env and a symlink out of the folder
//     Then the real upload logs one warning per file and does not send them
//
//   Scenario: dry run validates the sidecar
//     Given target tap-app and a malformed or missing metadata sidecar
//     Then the dry run fails, as the upload would
//
//   Scenario: unsafe paths in flags and --config
//     Given --output .., an absolute --include, a backslash --exclude, or --config outside
//       the deploy directory
//     Then deploy throws a plain-language error and nothing is uploaded
//
//   Scenario: invalid input
//     Given a missing folder, a missing upload root or an invalid config
//     Then deploy throws and nothing is uploaded
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as jsoncEsm from 'jsonc-parser/lib/esm/main.js';
import * as agentActual from 'zephyr-agent' with { rstest: 'importActual' };

rs.mock('jsonc-parser', () => ({
  parse: jsoncEsm.parse,
  printParseErrorCode: jsoncEsm.printParseErrorCode,
}));

const create = rs.fn();
const upload = rs.fn();
const disabled = rs.fn();
const log = rs.fn();

rs.mock('zephyr-agent', () => ({
  ...agentActual,
  ZephyrEngine: { create: (...args: unknown[]) => create(...args) },
  isZephyrDisabled: () => disabled(),
  logFn: (...args: unknown[]) => log(...args),
}));
rs.mock('../lib/upload', () => ({
  uploadAssets: (...args: unknown[]) => upload(...args),
}));

import { deployCommand, type DeployDryRunResult } from './deploy';

describe('deployCommand', () => {
  let cwd: string;
  let out: string;

  async function put(files: Record<string, string>, base = out): Promise<void> {
    for (const [name, content] of Object.entries(files)) {
      await mkdir(join(base, name, '..'), { recursive: true });
      await writeFile(join(base, name), content);
    }
  }
  const config = (extra: Record<string, unknown> = {}): string =>
    JSON.stringify({ version: '1.0.0', output: '.', include: ['**/*'], ...extra });

  beforeEach(async () => {
    create.mockReset();
    upload.mockReset();
    disabled.mockReset().mockReturnValue(false);
    log.mockReset();
    create.mockResolvedValue({
      env: {},
      application_uid: 'app',
      hasActiveBuild: false,
      build_failed: rs.fn(),
    });
    upload.mockResolvedValue({ versionUrl: null, targetUrls: [] });
    cwd = await mkdtemp(join(tmpdir(), 'zephyr-deploy-'));
    out = join(cwd, 'out');
    await mkdir(out);
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  async function dryRun(
    extra: Record<string, unknown> = {}
  ): Promise<DeployDryRunResult> {
    const result = await deployCommand({ directory: 'out', cwd, dryRun: true, ...extra });
    return result as DeployDryRunResult;
  }
  function uploadedPaths(): string[] {
    const call = upload.mock.calls[0]?.[0] as {
      assetsMap: Record<string, { path: string }>;
    };
    return Object.values(call.assetsMap).map((asset) => asset.path);
  }

  it('dry run lists files and makes no engine, disabled-check or upload call', async () => {
    await put({
      'index.js': 'abc',
      'index.js.map': 'm',
      '.env': 'S=1',
      'zephyr.config.json': config({ exclude: ['**/*.map'] }),
    });
    const result = await dryRun();
    expect(result.dryRun).toBe(true);
    expect(result.files).toEqual([{ path: 'index.js', size: 3 }]);
    expect(result.fileCount).toBe(1);
    expect(result.totalSize).toBe(3);
    expect(result.excluded.map((e) => [e.path, e.reason]).sort()).toEqual([
      ['.env', 'denylist'],
      ['index.js.map', 'exclude'],
      ['zephyr.config.json', 'exclude'],
    ]);
    expect(create).not.toHaveBeenCalled();
    expect(disabled).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('lists exactly the files that the real upload sends', async () => {
    await put({
      'index.js': 'abc',
      'a/b.css': 'x',
      'a/b.js.map': 'm',
      '.dev.vars': 'S=1',
      'zephyr.config.json': config({ exclude: ['**/*.css'] }),
    });
    const planned = (await dryRun()).files.map((f) => f.path).sort();
    await deployCommand({ directory: 'out', cwd });
    expect(uploadedPaths().sort()).toEqual(planned);
    expect(planned).toEqual(['a/b.js.map', 'index.js']);
  });

  it('lets CLI flags replace the config include and exclude', async () => {
    await put({
      'index.js': 'x',
      'a.css': 'x',
      'zephyr.config.json': config({ include: ['*.js'], exclude: ['a.css'] }),
    });
    const result = await dryRun({ include: ['*.css'], exclude: ['nothing'] });
    expect(result.files.map((f) => f.path)).toEqual(['a.css']);
  });

  it('keeps the legacy selection and logs the hint without a config', async () => {
    await put({ 'index.js': 'x', 'index.js.map': 'm', '.env': 'S=1' });
    const result = await dryRun();
    expect(result.files.map((f) => f.path)).toEqual(['index.js']);
    expect(log).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('zephyr.config.json')
    );
  });

  it('does not log the hint for json output', async () => {
    await put({ 'index.js': 'x' });
    await dryRun({ format: 'json' });
    expect(log).not.toHaveBeenCalled();
  });

  it('resolves output against the config folder and supports --config', async () => {
    await put({ 'conf/dist/index.js': 'x', 'conf/other.js': 'y' });
    await put({ 'conf/zephyr.config.json': config({ output: 'dist' }) });
    const result = await dryRun({ configPath: 'out/conf/zephyr.config.json' });
    expect(result.root).toBe(join(out, 'conf', 'dist'));
    expect(result.files.map((f) => f.path)).toEqual(['index.js']);
    const overridden = await dryRun({
      configPath: 'out/conf/zephyr.config.json',
      output: '.',
    });
    expect(overridden.files.map((f) => f.path).sort()).toEqual([
      'dist/index.js',
      'other.js',
    ]);
  });

  it('rejects --exclude without any include', async () => {
    await put({ 'index.js': 'x' });
    await expect(dryRun({ exclude: ['a'] })).rejects.toThrow(/--exclude needs --include/);
  });

  it('refuses a Wrangler config without a zephyr.config.json, before any engine call', async () => {
    await put({ 'index.js': 'x', 'wrangler.toml': 'name="x"' });
    await expect(dryRun()).rejects.toThrow(/wrangler\.toml.*zephyr\.config\.json/s);
    await expect(deployCommand({ directory: 'out', cwd })).rejects.toThrow(
      /wrangler\.toml/
    );
    expect(create).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('accepts a Wrangler config next to a zephyr.config.json and lists it as denylisted', async () => {
    await put({
      'index.js': 'x',
      'wrangler.toml': 'name="x"',
      'zephyr.config.json': config(),
    });
    const result = await dryRun();
    expect(result.files.map((f) => f.path)).toEqual(['index.js']);
    expect(result.excluded).toContainEqual({
      path: 'wrangler.toml',
      reason: 'denylist',
      rule: 'wrangler.toml',
    });
  });

  it('refuses TypeScript source in a dry run and in an upload', async () => {
    await put({ 'index.js': 'x', 'src/main.ts': 'x', 'zephyr.config.json': config() });
    await expect(dryRun()).rejects.toThrow(/TypeScript source/);
    await expect(deployCommand({ directory: 'out', cwd })).rejects.toThrow(
      /TypeScript source/
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('fails for a missing folder, a missing upload root and an invalid config', async () => {
    await expect(deployCommand({ directory: 'nope', cwd, dryRun: true })).rejects.toThrow(
      /Directory does not exist/
    );
    await put({ 'zephyr.config.json': config({ output: 'missing' }) });
    await expect(dryRun()).rejects.toThrow(/Upload folder does not exist/);
    await put({ 'zephyr.config.json': '{"version":"9"}' });
    await expect(dryRun()).rejects.toThrow(/zephyr\.config\.json/);
    expect(upload).not.toHaveBeenCalled();
  });

  it('throws before any engine exists when nothing is selected', async () => {
    await put({ 'index.js': 'x', 'zephyr.config.json': config({ include: ['*.css'] }) });
    await expect(deployCommand({ directory: 'out', cwd })).rejects.toThrow(
      /Nothing to upload: no file .* matched include \["\*\.css"\]/
    );
    expect(create).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns the plan with nothingToUpload for an empty dry run', async () => {
    await put({ 'index.js': 'x', 'zephyr.config.json': config({ include: ['*.css'] }) });
    const result = await dryRun();
    expect(result.fileCount).toBe(0);
    expect(result.nothingToUpload).toMatch(/Nothing to upload/);
    expect(result.excluded.length).toBeGreaterThan(0);
  });

  it('has no nothingToUpload when files are selected', async () => {
    await put({ 'index.js': 'x', 'zephyr.config.json': config() });
    expect((await dryRun()).nothingToUpload).toBeUndefined();
  });

  it('names the flags in the hint when no config exists', async () => {
    await put({ 'index.js': 'x' });
    await dryRun({ include: ['*.js'] });
    expect(log).toHaveBeenCalledWith('info', expect.stringContaining('flags choose'));
  });

  it('warns once per blocked file during a real upload and does not send them', async () => {
    const outside = join(cwd, 'outside.txt');
    await writeFile(outside, 'S=1');
    await put({ 'index.js': 'x', '.env': 'S=1', 'zephyr.config.json': config() });
    await symlink(outside, join(out, 'link.txt'));
    await deployCommand({ directory: 'out', cwd });
    expect(uploadedPaths()).toEqual(['index.js']);
    const warnings = log.mock.calls
      .filter(([level]) => level === 'warn')
      .map(([, message]) => String(message));
    expect(warnings).toHaveLength(2);
    expect(warnings.some((m) => m.includes('.env') && m.includes('never-upload'))).toBe(
      true
    );
    expect(
      warnings.some((m) => m.includes('link.txt') && m.includes('symbolic link'))
    ).toBe(true);
  });

  it('fails a tap-app dry run with a bad or missing sidecar', async () => {
    await put({ 'index.js': 'x', 'zephyr.config.json': config() });
    await expect(dryRun({ target: 'tap-app' })).rejects.toThrow();
    await put({ 'meta.json': '{ not json' });
    await expect(
      dryRun({ target: 'tap-app', metadataPath: join(out, 'meta.json') })
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    [{ output: '..' }, /--output must be a relative path/],
    [{ include: ['/etc/**'] }, /--include must be a relative path/],
    [{ include: ['**/*'], exclude: ['assets\\**'] }, /--exclude must be a relative path/],
  ])('rejects the unsafe flag %j', async (flags, message) => {
    await put({ 'index.js': 'x' });
    await expect(dryRun(flags)).rejects.toThrow(message);
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects a --config outside the deploy directory and accepts one inside', async () => {
    await put({ 'index.js': 'x' });
    await put({ 'elsewhere/zephyr.config.json': config() }, cwd);
    await expect(
      dryRun({ configPath: join(cwd, 'elsewhere', 'zephyr.config.json') })
    ).rejects.toThrow(/--config must point to a file inside the deploy directory/);
    await put({ 'sub/custom.json': config({ include: ['*.js'] }), 'sub/a.js': 'x' });
    const result = await dryRun({ configPath: 'out/sub/custom.json' });
    expect(result.files.map((f) => f.path)).toEqual(['a.js']);
  });

  it('returns the skipped result for ZE_DISABLED without selecting for upload', async () => {
    await put({ 'index.js': 'x' });
    disabled.mockReturnValue(true);
    await expect(deployCommand({ directory: 'out', cwd })).resolves.toEqual({
      skipped: true,
      reason: 'ZE_DISABLED',
    });
    expect(create).not.toHaveBeenCalled();
  });
});
