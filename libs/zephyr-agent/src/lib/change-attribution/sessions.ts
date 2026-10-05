import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ChangeOrigin, ChangeSession } from 'zephyr-edge-contract';

interface Observation {
  schemaVersion: number;
  agent: string;
  session: string;
  turn: string;
  turnAssociation?: ChangeOrigin['turnAssociation'];
  toolCall?: string;
  model?: string;
  harness?: string;
  promptInitiator?: ChangeOrigin['promptInitiator'];
  transcriptPath?: string;
  capturedAt: string;
  provider?: string;
  reasoningEffort?: string;
  usage?: ChangeSession['usage'];
  reportedCost?: ChangeSession['cost'];
}
const boundedRead = (filename: string) => {
  if (statSync(filename).size > 20 * 1024 * 1024) throw new Error('Metadata too large');
  return readFileSync(filename, 'utf8');
};
const string = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 512;
const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
function sanitizeUsage(raw: ChangeSession['usage']): ChangeSession['usage'] {
  if (raw?.scope !== 'session-cumulative') return undefined;
  return {
    scope: 'session-cumulative',
    inputTokens: count(raw.inputTokens),
    cachedInputTokens: count(raw.cachedInputTokens),
    cacheWriteInputTokens: count(raw.cacheWriteInputTokens),
    outputTokens: count(raw.outputTokens),
    reasoningOutputTokens: count(raw.reasoningOutputTokens),
    totalTokens: count(raw.totalTokens),
    incomplete: Boolean(raw.incomplete),
    observedAt: string(raw.observedAt) ? raw.observedAt : undefined,
  };
}

/** Refresh only the most recently finished native Grok turn, never older model turns. */
function finishedGrokUsage(row: Observation): Partial<ChangeSession> {
  try {
    if (!row.transcriptPath) return {};
    const directory = dirname(row.transcriptPath);
    const summary = JSON.parse(boundedRead(join(directory, 'summary.json')));
    const ledger = JSON.parse(boundedRead(join(directory, 'usage.json')));
    const updatedAt = Date.parse(ledger.updatedAt);
    const capturedAt = Date.parse(row.capturedAt);
    if (
      summary.info?.id !== row.session ||
      summary.last_turn_summary_prompt_id !== row.turn ||
      ledger.sessionId !== row.session ||
      !Number.isFinite(updatedAt) ||
      !Number.isFinite(capturedAt) ||
      updatedAt < capturedAt
    )
      return {};
    const raw = ledger.session;
    const usage = sanitizeUsage({
      scope: 'session-cumulative',
      observedAt: ledger.updatedAt,
      inputTokens: raw.inputTokens,
      cachedInputTokens: raw.cachedReadTokens,
      cacheWriteInputTokens: raw.cacheCreationTokens,
      outputTokens: raw.outputTokens,
      reasoningOutputTokens: raw.reasoningTokens,
      totalTokens: raw.totalTokens,
      incomplete: Boolean(raw.usageIsIncomplete),
    });
    return {
      usage,
      ...(count(raw.costUsdTicks) !== undefined
        ? {
            cost: {
              status: 'reported',
              currency: 'USD',
              usdTicks: raw.costUsdTicks,
              scope: 'session-cumulative',
              partial: Boolean(raw.costIsPartial),
              observedAt: ledger.updatedAt,
            } as ChangeSession['cost'],
          }
        : {}),
    };
  } catch {
    return {};
  }
}

/** Codex 0.160 rollout adapter: optional, local, bounded, and matched to exact turn IDs. */
export function readSessionMetadata(gitDir: string) {
  const sessions: Record<string, ChangeSession> = Object.create(null);
  const calls = new Map<string, string>();
  const transcripts = new Map<string, Map<string, Partial<ChangeSession>>>();
  try {
    const observations = boundedRead(join(gitDir, 'zephyr-attribution/events.jsonl'))
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as Observation];
        } catch {
          return [];
        }
      });
    for (const row of observations) {
      if (
        row.schemaVersion !== 1 ||
        !['codex', 'grok'].includes(row.agent) ||
        !string(row.session) ||
        !string(row.turn) ||
        !string(row.capturedAt)
      )
        continue;
      const key = createHash('sha256')
        .update(JSON.stringify([row.agent, row.session, row.turn]))
        .digest('hex');
      let turns = transcripts.get(row.session);
      if (row.agent === 'codex' && !turns && row.transcriptPath) {
        turns = new Map();
        try {
          let current: string | undefined;
          let provider: string | undefined;
          let validSession = false;
          for (const line of boundedRead(row.transcriptPath)
            .split('\n')
            .filter(Boolean)) {
            const event = JSON.parse(line);
            const payload = event.payload;
            if (event.type === 'session_meta') {
              validSession = payload?.id === row.session;
              provider = string(payload?.model_provider)
                ? payload.model_provider
                : undefined;
            }
            if (!validSession) continue;
            if (event.type === 'turn_context' && string(payload?.turn_id)) {
              current = payload.turn_id;
              turns.set(current!, {
                provider,
                model: string(payload.model) ? payload.model : undefined,
                reasoningEffort: string(payload.effort) ? payload.effort : undefined,
              });
            }
            const raw = payload?.info?.total_token_usage;
            if (
              current &&
              event.type === 'event_msg' &&
              payload?.type === 'token_count' &&
              raw
            ) {
              const turn = turns.get(current)!;
              turn.usage = {
                scope: 'session-cumulative',
                inputTokens: count(raw.input_tokens),
                cachedInputTokens: count(raw.cached_input_tokens),
                cacheWriteInputTokens: count(raw.cache_write_input_tokens),
                outputTokens: count(raw.output_tokens),
                reasoningOutputTokens: count(raw.reasoning_output_tokens),
                totalTokens: count(raw.total_tokens),
              };
            }
          }
          if (!validSession) turns.clear();
        } catch {
          turns.clear();
        }
        transcripts.set(row.session, turns);
      }
      const previous = sessions[key];
      sessions[key] = {
        ...previous,
        agent: row.agent,
        session: row.session,
        turn: row.turn,
        turnAssociation:
          row.turnAssociation === 'active-prompt'
            ? 'active-prompt'
            : (previous?.turnAssociation ??
              (row.turnAssociation === 'native-turn-id' ? 'native-turn-id' : undefined)),
        model: string(row.model) ? row.model : previous?.model,
        ...turns?.get(row.turn),
        harness: string(row.harness) ? row.harness : previous?.harness,
        promptInitiator:
          row.promptInitiator?.evidence === 'launcher-self-report' &&
          string(row.promptInitiator.id)
            ? { id: row.promptInitiator.id, evidence: 'launcher-self-report' }
            : previous?.promptInitiator,
        capturedAt: row.capturedAt,
        ...(row.agent === 'grok'
          ? {
              provider: string(row.provider) ? row.provider : undefined,
              reasoningEffort: string(row.reasoningEffort)
                ? row.reasoningEffort
                : undefined,
              usage: sanitizeUsage(row.usage),
            }
          : {}),
        evidence:
          row.agent === 'grok'
            ? 'grok-hook-and-session'
            : turns?.has(row.turn)
              ? 'codex-hook-and-rollout'
              : 'codex-hook',
        cost:
          row.agent === 'grok' &&
          row.reportedCost?.status === 'reported' &&
          count(row.reportedCost.usdTicks) !== undefined &&
          row.reportedCost.currency === 'USD' &&
          row.reportedCost.scope === 'session-cumulative'
            ? {
                status: 'reported',
                currency: 'USD',
                usdTicks: row.reportedCost.usdTicks,
                scope: 'session-cumulative',
                partial:
                  Boolean(row.reportedCost.partial) ||
                  !row.reportedCost.observedAt ||
                  !Number.isFinite(Date.parse(row.reportedCost.observedAt)) ||
                  !Number.isFinite(Date.parse(row.capturedAt)) ||
                  Date.parse(row.reportedCost.observedAt) < Date.parse(row.capturedAt),
                observedAt: string(row.reportedCost.observedAt)
                  ? row.reportedCost.observedAt
                  : undefined,
              }
            : {
                status: 'unavailable',
                reason:
                  'No billed cost reported by the harness; token counters are not an invoice',
              },
      };
      if (row.agent === 'grok') Object.assign(sessions[key], finishedGrokUsage(row));
      if (string(row.toolCall))
        calls.set(JSON.stringify([row.agent, row.session, row.toolCall]), key);
    }
  } catch {
    /* No optional integration evidence. */
  }
  return { sessions, calls };
}

export function sessionForOrigin(
  origin: ChangeOrigin,
  metadata: ReturnType<typeof readSessionMetadata>
) {
  if (origin.kind !== 'ai' || !origin.tool || !origin.session || !origin.toolCall)
    return undefined;
  const key = metadata.calls.get(
    JSON.stringify([origin.tool, origin.session, origin.toolCall])
  );
  const session = key && metadata.sessions[key];
  // A metadata mismatch must never relabel a contribution with another turn's model.
  return session && session.model === origin.model ? { key, session } : undefined;
}
