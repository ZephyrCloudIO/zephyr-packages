// Installed project hook. Records metadata only; never saves prompts or tool arguments.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');

function collect(event, environment = process.env) {
  const grok = typeof event.sessionId === 'string';
  const native = event;
  if (grok)
    event = {
      ...event,
      session_id: event.sessionId,
      turn_id: event.promptId,
      tool_use_id: event.toolUseId,
      transcript_path: event.transcriptPath,
      model: event.modelId,
    };
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: event.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const config = JSON.parse(fs.readFileSync(path.join(root, '.zephyr/attribution.json'), 'utf8'));
  if (config.schemaVersion !== 1 || !config.enabled) return;
  const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const storage = path.join(gitDir, 'zephyr-attribution');
  fs.mkdirSync(storage, { recursive: true, mode: 0o700 });
  if (typeof event.session_id !== 'string') return;
  const activePath = path.join(
    storage,
    'active-' + createHash('sha256').update(event.session_id).digest('hex') + '.json'
  );
  let inferredTurn = false;
  if (
    grok &&
    !event.turn_id &&
    ['PreToolUse', 'PostToolUse'].includes(event.hook_event_name) &&
    !native.isBackgrounded
  ) {
    try {
      const active = JSON.parse(fs.readFileSync(activePath, 'utf8'));
      if (active.active) {
        event.turn_id = active.turn;
        inferredTurn = true;
      }
    } catch {
      /* Unassociated/background tools stay unknown. */
    }
  }
  if (typeof event.session_id !== 'string' || typeof event.turn_id !== 'string') return;
  if (grok && event.hook_event_name === 'UserPromptSubmit')
    fs.writeFileSync(activePath, JSON.stringify({ turn: event.turn_id, active: true }), {
      mode: 0o600,
    });
  const text = (value) => (typeof value === 'string' && value.length <= 512 ? value : undefined);
  const observation = {
    schemaVersion: 1,
    agent: grok ? 'grok' : 'codex',
    session: event.session_id,
    turn: event.turn_id,
    turnAssociation: inferredTurn ? 'active-prompt' : 'native-turn-id',
    event: text(event.hook_event_name),
    toolCall: text(event.tool_use_id),
    model: text(event.model),
    capturedAt: new Date().toISOString(),
    // The launcher supplies this. It is not an authenticated identity assertion.
    harness: text(environment.ZE_ATTRIBUTION_HARNESS),
    promptInitiator: text(environment.ZE_ATTRIBUTION_INITIATOR)
      ? { id: text(environment.ZE_ATTRIBUTION_INITIATOR), evidence: 'launcher-self-report' }
      : undefined,
    transcriptPath: text(event.transcript_path), // local only, removed from published metadata
  };
  if (grok && event.transcript_path) {
    try {
      const summaryPath = path.join(path.dirname(event.transcript_path), 'summary.json');
      if (fs.statSync(summaryPath).size > 1024 * 1024) throw new Error('Summary too large');
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.info?.id !== observation.session) throw new Error('Different native session');
      observation.model ??= text(summary.current_model_id);
      observation.reasoningEffort = text(summary.reasoning_effort);
      observation.provider = 'xai';
      const usagePath = path.join(path.dirname(event.transcript_path), 'usage.json');
      if (fs.existsSync(usagePath) && fs.statSync(usagePath).size <= 1024 * 1024) {
        const usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
        if (usage.sessionId === observation.session) {
          const raw = usage.session;
          const count = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : undefined);
          observation.usage = {
            scope: 'session-cumulative',
            observedAt: usage.updatedAt,
            inputTokens: count(raw.inputTokens),
            cachedInputTokens: count(raw.cachedReadTokens),
            cacheWriteInputTokens: count(raw.cacheCreationTokens),
            outputTokens: count(raw.outputTokens),
            reasoningOutputTokens: count(raw.reasoningTokens),
            totalTokens: count(raw.totalTokens),
            // Hooks can run before Grok flushes this turn's final ledger.
            incomplete: true,
          };
          if (count(raw.costUsdTicks) !== undefined)
            observation.reportedCost = {
              status: 'reported',
              currency: 'USD',
              usdTicks: raw.costUsdTicks,
              scope: 'session-cumulative',
              partial: true,
              observedAt: usage.updatedAt,
            };
        }
      }
    } catch {
      /* Unknown model remains unknown; no default model guessing. */
    }
    // Git AI's public custom-agent API brackets each mutating tool as an operation.
    // Invocation identity keeps file-edit attribution tied to this exact tool/turn.
    if (
      observation.model &&
      observation.toolCall &&
      ['PreToolUse', 'PostToolUse'].includes(observation.event) &&
      /^(run_terminal_command|search_replace|write|write_file|apply_patch|edit_file)$/.test(
        native.toolName
      )
    ) {
      const payload = {
        type: observation.event === 'PreToolUse' ? 'pre_shell_command' : 'post_shell_command',
        repo_working_dir: root,
        agent_name: 'grok',
        model: observation.model,
        conversation_id: JSON.stringify([
          observation.session,
          observation.turn,
          observation.toolCall,
        ]),
        tool_use_id: observation.toolCall,
      };
      try {
        execFileSync(
          config.gitAiPath || 'git-ai',
          ['checkpoint', 'agent-v1', '--hook-input', 'stdin'],
          {
            cwd: root,
            input: JSON.stringify(payload),
            timeout: 5000,
            stdio: ['pipe', 'ignore', 'ignore'],
            env: environment,
          }
        );
      } catch {
        /* File attribution unavailable; session metadata can still be recorded. */
      }
    }
  }
  fs.appendFileSync(path.join(storage, 'events.jsonl'), JSON.stringify(observation) + '\n', {
    mode: 0o600,
  });
  if (grok && ['Stop', 'StopCancelled', 'StopFailure'].includes(event.hook_event_name))
    fs.writeFileSync(activePath, JSON.stringify({ turn: event.turn_id, active: false }), {
      mode: 0o600,
    });
}
module.exports = { collect };
if (require.main === module) {
  try {
    const input = fs.readFileSync(0, 'utf8');
    if (Buffer.byteLength(input) > 8 * 1024 * 1024) throw new Error('Hook input too large');
    collect(JSON.parse(input));
  } catch {
    // Optional telemetry must not stop an edit, and errors must not echo private input.
    process.stderr.write('Zephyr session metadata could not be recorded.\n');
  }
}
