import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSessionMetadata, sessionForOrigin } from './sessions';

describe('session evidence', () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'zephyr-session-'));
    mkdirSync(join(directory, 'zephyr-attribution'));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));
  it('keeps model/effort switches per turn, joins exact calls, and omits prompt text', () => {
    const transcript = join(directory, 'rollout.jsonl');
    const row = (type: string, payload: unknown) => JSON.stringify({ type, payload });
    writeFileSync(
      transcript,
      [
        row('session_meta', { id: 'session', model_provider: 'openai' }),
        row('turn_context', { turn_id: 'high', model: 'sol', effort: 'high' }),
        row('event_msg', { type: 'user_message', message: 'PRIVATE PROMPT' }),
        row('event_msg', {
          type: 'token_count',
          info: {
            total_token_usage: {
              input_tokens: 100,
              cached_input_tokens: 40,
              output_tokens: 10,
              reasoning_output_tokens: 5,
              total_tokens: 110,
            },
          },
        }),
        row('turn_context', { turn_id: 'low', model: 'sol', effort: 'low' }),
        row('event_msg', {
          type: 'token_count',
          info: {
            total_token_usage: {
              input_tokens: 150,
              output_tokens: 20,
              total_tokens: 170,
            },
          },
        }),
        row('turn_context', { turn_id: 'luna', model: 'luna', effort: 'xhigh' }),
      ].join('\n')
    );
    writeFileSync(
      join(directory, 'zephyr-attribution/events.jsonl'),
      ['high', 'low', 'luna']
        .map((turn) =>
          JSON.stringify({
            schemaVersion: 1,
            agent: 'codex',
            session: 'session',
            turn,
            toolCall: turn,
            model: turn === 'luna' ? 'luna' : 'sol',
            transcriptPath: transcript,
            capturedAt: '2026-10-03',
            harness: 'codex-cli',
            promptInitiator: { id: 'Zack', evidence: 'launcher-self-report' },
          })
        )
        .join('\n')
    );
    const metadata = readSessionMetadata(directory);
    const match = (turn: string, model: string) =>
      sessionForOrigin(
        {
          kind: 'ai',
          tool: 'codex',
          session: 'session',
          toolCall: turn,
          model,
          evidence: 'git-ai-checkpoint',
        },
        metadata
      );
    expect(match('high', 'sol')!.session.reasoningEffort).toBe('high');
    expect(match('low', 'sol')!.session.reasoningEffort).toBe('low');
    expect(match('luna', 'luna')!.session.reasoningEffort).toBe('xhigh');
    expect(match('high', 'luna')).toBeUndefined();
    expect(match('high', 'sol')!.session.usage?.totalTokens).toBe(110);
    expect(match('low', 'sol')!.session.usage?.totalTokens).toBe(170);
    expect(match('high', 'sol')!.session.cost.status).toBe('unavailable');
    expect(JSON.stringify(metadata.sessions)).not.toContain('PRIVATE PROMPT');
    expect(JSON.stringify(metadata.sessions)).not.toContain(transcript);
  });
  it('keeps observed Grok cost separate from counters and rejects arbitrary extra fields', () => {
    writeFileSync(
      join(directory, 'zephyr-attribution/events.jsonl'),
      JSON.stringify({
        schemaVersion: 1,
        agent: 'grok',
        session: 'grok-session',
        turn: 'prompt',
        toolCall: 'edit',
        model: 'grok',
        harness: 't3',
        capturedAt: '2026-10-03',
        provider: 'xai',
        reasoningEffort: 'high',
        usage: {
          scope: 'session-cumulative',
          inputTokens: 20,
          outputTokens: -1,
          prompt: 'PRIVATE',
        },
        reportedCost: {
          status: 'reported',
          scope: 'session-cumulative',
          currency: 'USD',
          usdTicks: 123,
          partial: true,
          prompt: 'PRIVATE',
        },
      })
    );
    const session = Object.values(readSessionMetadata(directory).sessions)[0];
    expect(session.harness).toBe('t3');
    expect(session.usage?.inputTokens).toBe(20);
    expect(session.usage?.outputTokens).toBeUndefined();
    expect(session.cost).toMatchObject({
      status: 'reported',
      usdTicks: 123,
      partial: true,
    });
    expect(JSON.stringify(session)).not.toContain('PRIVATE');
  });
  it('refreshes only the finished Grok turn and leaves earlier snapshots partial', () => {
    const native = join(directory, 'native');
    mkdirSync(native);
    writeFileSync(
      join(native, 'summary.json'),
      JSON.stringify({
        info: { id: 'grok-session' },
        last_turn_summary_prompt_id: 'second',
        current_model_id: 'grok-fast',
      })
    );
    writeFileSync(
      join(native, 'usage.json'),
      JSON.stringify({
        sessionId: 'grok-session',
        updatedAt: '2026-10-03T20:00:03Z',
        session: { inputTokens: 100, totalTokens: 120, costUsdTicks: 50 },
      })
    );
    writeFileSync(
      join(directory, 'zephyr-attribution/events.jsonl'),
      ['first', 'second']
        .map((turn) =>
          JSON.stringify({
            schemaVersion: 1,
            agent: 'grok',
            session: 'grok-session',
            turn,
            toolCall: turn,
            model: turn === 'first' ? 'grok' : 'grok-fast',
            capturedAt: '2026-10-03T20:00:02Z',
            transcriptPath: join(native, 'updates.jsonl'),
            reportedCost: {
              status: 'reported',
              scope: 'session-cumulative',
              currency: 'USD',
              usdTicks: 10,
              partial: false,
              observedAt: '2026-10-03T20:00:00Z',
            },
          })
        )
        .join('\n')
    );
    const sessions = Object.values(readSessionMetadata(directory).sessions);
    expect(sessions[0].model).toBe('grok');
    expect(sessions[0].cost).toMatchObject({ usdTicks: 10, partial: true });
    expect(sessions[1].cost).toMatchObject({ usdTicks: 50, partial: false });
    expect(sessions[1].usage?.totalTokens).toBe(120);
    writeFileSync(
      join(native, 'usage.json'),
      JSON.stringify({
        sessionId: 'grok-session',
        updatedAt: 'invalid',
        session: { totalTokens: 999, costUsdTicks: 999 },
      })
    );
    const invalid = Object.values(readSessionMetadata(directory).sessions)[1];
    expect(invalid.cost).toMatchObject({ usdTicks: 10, partial: true });
    expect(invalid.usage).toBeUndefined();
  });
});
