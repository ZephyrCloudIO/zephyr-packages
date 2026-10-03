import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureAttribution, offerAttribution } from '../attribution';

describe('optional Change Attribution setup', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'with-zephyr-attribution-'));
    execFileSync('git', ['init', '-q', root]);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  it('merges project hooks idempotently and preserves existing settings', () => {
    mkdirSync(join(root, '.claude'));
    writeFileSync(
      join(root, '.claude/settings.json'),
      JSON.stringify({
        permissions: { allow: ['Read'] },
        hooks: {
          PostToolUse: [
            { matcher: 'Write', hooks: [{ type: 'command', command: 'existing-hook' }] },
          ],
        },
      })
    );
    const options = {
      attributionAgents: ['codex', 'claude'],
      gitAiPath: '/missing/git-ai',
    };
    configureAttribution(root, options);
    configureAttribution(root, options);
    const settings = JSON.parse(
      readFileSync(join(root, '.claude/settings.json'), 'utf8')
    );
    expect(settings.permissions.allow).toEqual(['Read']);
    expect(settings.hooks.PostToolUse).toHaveLength(2);
    expect(settings.hooks.PostToolUse[0].hooks[0].command).toBe('existing-hook');
    const codex = JSON.parse(readFileSync(join(root, '.codex/hooks.json'), 'utf8'));
    expect(codex.hooks.PreToolUse).toHaveLength(1);
    expect(codex.hooks.PostToolUse[0].hooks[0].command).toBe(
      "'/missing/git-ai' checkpoint codex --hook-input stdin"
    );
    expect(codex.hooks.Stop).toBeUndefined();
    expect(codex).not.toHaveProperty('trusted');
  });
  it('validates all hook documents before writing any files', () => {
    mkdirSync(join(root, '.claude'));
    writeFileSync(join(root, '.claude/settings.json'), '{');
    expect(() =>
      configureAttribution(root, { attributionAgents: ['codex', 'claude'] })
    ).toThrow();
    expect(existsSync(join(root, '.zephyr'))).toBe(false);
    expect(existsSync(join(root, '.codex'))).toBe(false);
  });
  it('keeps dry-run and declined setup free of writes', async () => {
    configureAttribution(root, { dryRun: true, attributionAgents: ['codex'] });
    await offerAttribution(root, { attribution: false });
    expect(existsSync(join(root, '.zephyr'))).toBe(false);
    expect(existsSync(join(root, '.codex'))).toBe(false);
  });
  it('rejects unsupported integrations and unsafe executable paths', () => {
    expect(() => configureAttribution(root, { attributionAgents: ['invented'] })).toThrow(
      'Supported attribution agents'
    );
    expect(() => configureAttribution(root, { gitAiPath: "bad'command" })).toThrow(
      'quotes'
    );
  });
});
