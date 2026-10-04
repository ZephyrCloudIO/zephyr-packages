import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readAttributionConfig,
  validateAttributionConfig,
  writeAttributionConfig,
} from './config';

describe('local-only attribution configuration', () => {
  let root: string;
  let gitDir: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'zephyr-local-config-'));
    gitDir = join(root, '.git');
    mkdirSync(join(root, '.zephyr'));
    mkdirSync(gitDir);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const config = { schemaVersion: 1 as const, enabled: true, storage: 'local' as const };
  it('normalizes legacy remote preferences without granting source sharing', () => {
    writeFileSync(
      join(root, '.zephyr/attribution.json'),
      JSON.stringify({
        ...config,
        storage: 'remote',
        content: { patch: true, lines: true },
      })
    );
    expect(readAttributionConfig(root, gitDir)?.storage).toBe('local');
    expect(() => validateAttributionConfig({ ...config, storage: 'remote' })).toThrow();
  });
  it.each([
    { token: 'secret' },
    { url: 'https://example.invalid' },
    { tier: 'byoc' },
    { future: true },
    { content: { unknown: true } },
  ])('rejects unsupported configuration %j', (extra) => {
    writeFileSync(
      join(root, '.zephyr/attribution.json'),
      JSON.stringify({ ...config, ...extra })
    );
    expect(() => readAttributionConfig(root, gitDir)).toThrow();
  });
  it('writes private overrides without modifying shared preferences', () => {
    writeAttributionConfig(root, gitDir, config);
    const shared = readFileSync(join(root, '.zephyr/attribution.json'), 'utf8');
    writeAttributionConfig(root, gitDir, config, true);
    expect(readFileSync(join(root, '.zephyr/attribution.json'), 'utf8')).toBe(shared);
    expect(
      statSync(join(gitDir, 'zephyr-attribution/config.local.json')).mode & 0o777
    ).toBe(0o600);
    expect(readAttributionConfig(root, gitDir)?.storage).toBe('local');
    writeFileSync(
      join(gitDir, 'zephyr-attribution/config.local.json'),
      '{"storage":"remote"}'
    );
    expect(() => readAttributionConfig(root, gitDir)).toThrow();
  });
  it('rejects symlinked preferences when reading and writing', () => {
    const target = join(root, 'target.json');
    writeFileSync(target, JSON.stringify(config));
    symlinkSync(target, join(root, '.zephyr/attribution.json'));
    expect(() => readAttributionConfig(root, gitDir)).toThrow(/symlink/);
    expect(() => writeAttributionConfig(root, gitDir, config)).toThrow(/symlink/);
    expect(readFileSync(target, 'utf8')).toBe(JSON.stringify(config));
  });
});
