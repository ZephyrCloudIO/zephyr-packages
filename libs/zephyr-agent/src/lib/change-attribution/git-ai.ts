import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangeAttributionRange, ChangeOrigin } from 'zephyr-edge-contract';

interface Agent {
  tool: string;
  id: string;
  model: string;
}
interface Range {
  start_line: number;
  end_line: number;
  author_id: string;
}
interface Entry {
  file: string;
  blob_sha: string;
  line_attributions: Range[];
}
interface Checkpoint {
  kind: string;
  author: string;
  agent_id?: Agent;
  agent_metadata?: { tool_use_id?: string };
  api_version: string;
  git_ai_version?: string;
  entries: Entry[];
}
export const unknownOrigin: ChangeOrigin = { kind: 'unknown', evidence: 'none' };
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

/** Adapter for Git AI 1.7's local checkpoint/1.0.0 format. Fail closed on drift. */
export function readGitAiWorkingAttribution(gitDir: string, commit: string) {
  const entries = new Map<string, Entry>();
  const authors = new Map<string, ChangeOrigin>();
  const directory = join(gitDir, 'ai', 'working_logs', commit || 'empty');
  const filename = join(directory, 'checkpoints.jsonl');
  try {
    const initialPath = join(directory, 'INITIAL');
    if (existsSync(initialPath)) {
      if (statSync(initialPath).size > 20 * 1024 * 1024) return { entries, authors };
      const initial = JSON.parse(readFileSync(initialPath, 'utf8'));
      for (const [file, ranges] of Object.entries(initial.files ?? {})) {
        if (initial.file_blobs?.[file])
          entries.set(file, {
            file,
            blob_sha: initial.file_blobs[file],
            line_attributions: ranges as Range[],
          });
      }
      for (const [id, human] of Object.entries(initial.humans ?? {}))
        authors.set(id, {
          kind: 'human',
          human: (human as { author: string }).author,
          evidence: 'git-ai-checkpoint',
        });
      for (const [id, prompt] of Object.entries(initial.prompts ?? {})) {
        const value = prompt as { agent_id?: Agent; human_author?: string };
        if (value.agent_id)
          authors.set(id, {
            kind: 'ai',
            human: value.human_author,
            tool: value.agent_id.tool,
            model: value.agent_id.model,
            session: value.agent_id.id,
            evidence: 'git-ai-checkpoint',
          });
      }
      // Expand persisted session records to exact trace keys present in INITIAL only.
      for (const entry of entries.values())
        for (const range of entry.line_attributions ?? []) {
          const session = initial.sessions?.[range.author_id.split('::')[0]];
          if (session?.agent_id)
            authors.set(range.author_id, {
              kind: 'ai',
              human: session.human_author,
              tool: session.agent_id.tool,
              model: session.agent_id.model,
              session: session.agent_id.id,
              evidence: 'git-ai-checkpoint',
            });
        }
    }
    if (existsSync(filename) && statSync(filename).size > 20 * 1024 * 1024)
      throw new Error('Checkpoint log too large');
    for (const line of (existsSync(filename) ? readFileSync(filename, 'utf8') : '')
      .split('\n')
      .filter(Boolean)) {
      const checkpoint = JSON.parse(line) as Checkpoint;
      if (
        checkpoint.api_version !== 'checkpoint/1.0.0' ||
        !checkpoint.git_ai_version?.startsWith('1.7.') ||
        !Array.isArray(checkpoint.entries)
      ) {
        throw new Error('Unsupported checkpoint schema');
      }
      if (
        (checkpoint.kind === 'AiAgent' || checkpoint.kind === 'AiTab') &&
        checkpoint.agent_id
      ) {
        const agent = checkpoint.agent_id;
        // Git AI hashes the tool + session identity; model may change in one session.
        const session = `s_${hash(`${agent.tool}:${agent.id}`).slice(0, 14)}`;
        let nativeSession = agent.id;
        let toolCall = checkpoint.agent_metadata?.tool_use_id;
        if (agent.tool === 'grok') {
          try {
            const invocation = JSON.parse(agent.id);
            if (
              Array.isArray(invocation) &&
              invocation.length === 3 &&
              invocation.every((part) => typeof part === 'string')
            ) {
              nativeSession = invocation[0];
              toolCall = invocation[2];
            }
          } catch {
            /* Ordinary Grok session IDs remain unchanged. */
          }
        }
        const origin: ChangeOrigin = {
          kind: 'ai',
          human: checkpoint.author,
          tool: agent.tool,
          model: agent.model,
          session: nativeSession,
          toolCall,
          evidence: 'git-ai-checkpoint',
        };
        // Match only this checkpoint's trace; don't relabel older turns after a model switch.
        const trace = (checkpoint as Checkpoint & { trace_id?: string }).trace_id;
        for (const entry of checkpoint.entries)
          for (const range of entry.line_attributions ?? []) {
            if (
              range.author_id === session ||
              (trace && range.author_id === `${session}::${trace}`)
            )
              authors.set(range.author_id, origin);
          }
      } else if (checkpoint.kind === 'KnownHuman') {
        authors.set(`h_${hash(checkpoint.author).slice(0, 14)}`, {
          kind: 'human',
          human: checkpoint.author,
          evidence: 'git-ai-checkpoint',
        });
      }
      for (const entry of checkpoint.entries) entries.set(entry.file, entry);
    }
  } catch {
    entries.clear();
    authors.clear();
  }
  return { entries, authors };
}

export function workingRanges(
  entry: Entry | undefined,
  contentHash: string,
  authors: Map<string, ChangeOrigin>
): ChangeAttributionRange[] | undefined {
  if (!entry || entry.blob_sha !== contentHash) return undefined;
  return (entry.line_attributions ?? [])
    .map((range) => ({
      start: range.start_line,
      end: range.end_line,
      origin: authors.get(range.author_id) ?? unknownOrigin,
    }))
    .filter(
      (range) =>
        Number.isSafeInteger(range.start) &&
        range.start > 0 &&
        Number.isSafeInteger(range.end) &&
        range.end >= range.start
    );
}

/** JSON blame covers HEAD. Call only when captured content equals the HEAD blob. */
export function committedRanges(
  root: string,
  binary: string,
  file: string,
  commit: string
): ChangeAttributionRange[] {
  let ranges: ChangeAttributionRange[] = [];
  try {
    const blame = JSON.parse(
      execFileSync(binary, ['blame', '--json', commit, '--', file], {
        cwd: root,
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 4 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    );
    ranges = Object.entries(blame.lines ?? {})
      .map(([key, id]) => {
        const [start, end = start] = key.split('-').map(Number);
        const prompt = blame.prompts?.[String(id)];
        const agent = prompt?.agent_id;
        return {
          start,
          end,
          origin: agent
            ? {
                kind: 'ai' as const,
                human: prompt.human_author,
                tool: agent.tool,
                model: agent.model,
                session: agent.id,
                evidence: 'git-ai-blame' as const,
              }
            : unknownOrigin,
        };
      })
      .filter(
        ({ start, end }) =>
          Number.isSafeInteger(start) &&
          start > 0 &&
          Number.isSafeInteger(end) &&
          end >= start
      );
  } catch {
    /* AI evidence unavailable; known-human Git notes may still exist. */
  }
  return [
    ...ranges,
    ...committedHumanRanges(root, file, commit).filter(
      (human) =>
        !ranges.some((range) => range.start <= human.start && range.end >= human.start)
    ),
  ];
}

/** Git AI 1.7 JSON blame omits known humans. Read only explicit v3 human attestations. */
function committedHumanRanges(
  root: string,
  file: string,
  commit: string
): ChangeAttributionRange[] {
  const notes = new Map<
    string,
    | {
        metadata: { humans?: Record<string, { author: string }> };
        files: Map<string, { id: string; start: number; end: number }[]>;
      }
    | undefined
  >();
  const run = (args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  function note(sha: string) {
    if (notes.has(sha)) return notes.get(sha);
    try {
      const text = run(['notes', '--ref=ai', 'show', sha]);
      const divider = text.indexOf('\n---\n');
      if (divider < 0) throw new Error('Unsupported authorship note');
      const metadata = JSON.parse(text.slice(divider + 5));
      if (
        metadata.schema_version !== 'authorship/3.0.0' ||
        !metadata.git_ai_version?.startsWith('1.7.')
      )
        throw new Error('Unsupported authorship note');
      const files = new Map<string, { id: string; start: number; end: number }[]>();
      let current = '';
      for (const line of text.slice(0, divider).split('\n')) {
        if (!line.startsWith('  ')) {
          current = line.startsWith('"') ? JSON.parse(line) : line;
          files.set(current, []);
        } else {
          const match = /^  (h_[a-f0-9]{14}) ([\d,-]+)$/.exec(line);
          if (!match) continue;
          for (const token of match[2].split(',')) {
            const [start, end = start] = token.split('-').map(Number);
            if (
              Number.isSafeInteger(start) &&
              start > 0 &&
              Number.isSafeInteger(end) &&
              end >= start
            ) {
              files.get(current)?.push({ id: match[1], start, end });
            }
          }
        }
      }
      const parsed = { metadata, files };
      notes.set(sha, parsed);
      return parsed;
    } catch {
      notes.set(sha, undefined);
      return undefined;
    }
  }
  const ranges: ChangeAttributionRange[] = [];
  try {
    let sha = '';
    let original = 0;
    let current = 0;
    let originalFile = file;
    for (const line of run(['blame', '--line-porcelain', commit, '--', file]).split(
      '\n'
    )) {
      const header = /^([a-f0-9]{40,64}) (\d+) (\d+)(?: \d+)?$/.exec(line);
      if (header) {
        sha = header[1];
        original = Number(header[2]);
        current = Number(header[3]);
      } else if (line.startsWith('filename ')) {
        const value = line.slice(9);
        originalFile = value.startsWith('"') ? JSON.parse(value) : value;
      } else if (line.startsWith('\t')) {
        const record = note(sha);
        const human = record?.files
          .get(originalFile)
          ?.find((range) => range.start <= original && range.end >= original);
        const author = human && record?.metadata.humans?.[human.id]?.author;
        if (typeof author === 'string')
          ranges.push({
            start: current,
            end: current,
            origin: { kind: 'human', human: author, evidence: 'git-ai-blame' },
          });
      }
    }
  } catch {
    return [];
  }
  return ranges;
}
