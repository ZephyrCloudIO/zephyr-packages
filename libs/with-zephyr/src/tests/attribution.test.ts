import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
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

const prompt = rs.hoisted(() => ({ question: rs.fn(), close: rs.fn() }));
rs.mock('node:readline/promises', () => ({ createInterface: () => prompt }));

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
    expect(codex.hooks.PreToolUse).toHaveLength(2);
    expect(codex.hooks.PostToolUse[0].hooks[0].command).toBe(
      "'/missing/git-ai' checkpoint codex --hook-input stdin"
    );
    expect(codex.hooks.Stop[0].hooks[0].command).toContain('attribution-hook.cjs');
    expect(readFileSync(join(root, '.zephyr/attribution-hook.cjs'), 'utf8')).toContain(
      'launcher-self-report'
    );
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
  it('defaults to local and offers remote without storing credentials or account tier', () => {
    configureAttribution(root, {});
    const file = join(root, '.zephyr/attribution.json');
    expect(JSON.parse(readFileSync(file, 'utf8')).storage).toBe('local');
    configureAttribution(root, { attributionStorage: 'remote' });
    expect(JSON.parse(readFileSync(file, 'utf8')).storage).toBe('remote');
    expect(() => configureAttribution(root, { attributionStorage: 'invented' })).toThrow(
      'local or remote'
    );
    writeFileSync(file, '{"schemaVersion":1,"enabled":true,"token":"secret"}');
    expect(() => configureAttribution(root, {})).toThrow('credentials');
  });
  it('preserves remote storage when the interactive storage answer is blank', async () => {
    configureAttribution(root, { attributionStorage: 'remote' });
    const stdin = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    const stdout = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    try {
      Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
      Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
      prompt.question.mockResolvedValueOnce('');
      await offerAttribution(root, { attribution: true, attributionAgents: [] });
      expect(
        JSON.parse(readFileSync(join(root, '.zephyr/attribution.json'), 'utf8')).storage
      ).toBe('remote');
    } finally {
      if (stdin) Object.defineProperty(process.stdin, 'isTTY', stdin);
      else delete process.stdin.isTTY;
      if (stdout) Object.defineProperty(process.stdout, 'isTTY', stdout);
      else delete process.stdout.isTTY;
    }
  });
  it('records Grok tools against an explicitly inferred active prompt and closes it on stop', () => {
    configureAttribution(root, {
      attributionAgents: ['grok'],
      gitAiPath: '/missing/git-ai',
    });
    const settings = JSON.parse(
      readFileSync(join(root, '.grok/hooks/zephyr-attribution.json'), 'utf8')
    );
    const matcher = new RegExp(settings.hooks.PostToolUse[0].matcher);
    expect(matcher.test('search_replace')).toBe(true);
    expect(matcher.test('run_terminal_command')).toBe(true);
    const hook = join(root, '.zephyr/attribution-hook.cjs');
    const sessionDir = join(root, '.git', 'native-session');
    mkdirSync(sessionDir);
    const transcript = join(sessionDir, 'updates.jsonl');
    writeFileSync(
      join(sessionDir, 'summary.json'),
      JSON.stringify({
        info: { id: 'grok-session' },
        current_model_id: 'grok-4.7',
        reasoning_effort: 'high',
      })
    );
    writeFileSync(
      join(sessionDir, 'usage.json'),
      JSON.stringify({
        sessionId: 'grok-session',
        updatedAt: '2026-10-03',
        session: { inputTokens: 42, costUsdTicks: 10, costIsPartial: true },
      })
    );
    const run = (event: Record<string, unknown>) => {
      if (event.toolName && !matcher.test(String(event.toolName))) return;
      return execFileSync(process.execPath, [hook], {
        input: JSON.stringify({
          sessionId: 'grok-session',
          cwd: root,
          transcriptPath: transcript,
          ...event,
        }),
        env: {
          ...process.env,
          ZE_ATTRIBUTION_HARNESS: 't3',
          ZE_ATTRIBUTION_INITIATOR: 'Zack',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    };
    run({
      hook_event_name: 'UserPromptSubmit',
      promptId: 'prompt-1',
      prompt: 'PRIVATE PROMPT',
    });
    run({
      hook_event_name: 'PostToolUse',
      toolUseId: 'edit-1',
      toolName: 'search_replace',
      toolInput: { text: 'PRIVATE CONTENT' },
    });
    run({
      hook_event_name: 'Stop',
      promptId: 'prompt-1',
      lastAssistantMessage: 'PRIVATE RESPONSE',
    });
    run({ hook_event_name: 'PostToolUse', toolUseId: 'background', toolName: 'write' });
    const log = readFileSync(join(root, '.git/zephyr-attribution/events.jsonl'), 'utf8');
    const rows = log
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({
      agent: 'grok',
      turn: 'prompt-1',
      turnAssociation: 'active-prompt',
      toolCall: 'edit-1',
      model: 'grok-4.7',
      reasoningEffort: 'high',
      harness: 't3',
      reportedCost: { usdTicks: 10, partial: true },
    });
    expect(log).not.toContain('PRIVATE');
    expect(rows[1].promptInitiator).toEqual({
      id: 'Zack',
      evidence: 'launcher-self-report',
    });
  });
});
