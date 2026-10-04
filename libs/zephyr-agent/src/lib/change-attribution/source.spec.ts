import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import {
  captureSource,
  finishSourceCapture,
  loadSourceRecord,
  sourceCommitBaseline,
} from './source';
import { compareSourceRecords } from './compare';

rs.mock('node:child_process', { spy: true });

describe('Change Attribution source records', () => {
  let root: string;
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  const put = (file: string, text: string) => {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  const enabled = () =>
    put(
      '.zephyr/attribution.json',
      JSON.stringify({ schemaVersion: 1, enabled: true, gitAiPath: '/missing/git-ai' })
    );
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'zephyr-attribution-test-'));
    git('init', '-q');
    git('config', 'user.name', 'Test Contributor');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'gc.auto', '0');
    git('config', 'maintenance.auto', 'false');
    git('config', 'core.hooksPath', join(root, '.git', 'hooks'));
    put('app.txt', 'original\n');
    put('.gitignore', 'ignored.txt\n');
    git('add', '.');
    git('commit', '-qm', 'Initial source');
  });
  afterEach(() =>
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );

  it('writes nothing before opt-in and honors disabled configuration', () => {
    expect(captureSource(root)).toBeUndefined();
    put('.zephyr/attribution.json', '{"schemaVersion":1,"enabled":false}');
    expect(captureSource(root)).toBeUndefined();
    expect(existsSync(join(root, '.git', 'zephyr-attribution'))).toBe(false);
  });
  it('distinguishes two dirty versions at the same commit, using the working copy over the index', () => {
    enabled();
    const before = captureSource(root)!.record!;
    put('app.txt', 'staged\n');
    git('add', 'app.txt');
    put('app.txt', 'actually built\n');
    put('new.txt', 'untracked\n');
    rmSync(join(root, '.gitignore'));
    const after = captureSource(root)!.record!;
    const comparison = compareSourceRecords(root, before.id, after.id);
    expect(comparison.sameCommit).toBe(true);
    expect(after.dirty).toBe(true);
    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(comparison.changes.map((change) => [change.file, change.status])).toEqual([
      ['.gitignore', 'deleted'],
      ['app.txt', 'modified'],
      ['new.txt', 'added'],
    ]);
    expect(comparison.changes[1].lines.find((line) => line.operation === 'add')).toEqual({
      operation: 'add',
      line: 1,
      text: 'actually built',
      origin: { kind: 'unknown', evidence: 'none' },
    });
    put('app.txt', 'original\n');
    put('.gitignore', 'ignored.txt\n');
    rmSync(join(root, 'new.txt'));
    expect(captureSource(root)!.record!.fingerprint).toBe(before.fingerprint);
  });
  it('omits ignored files, build output, secrets, and configured prefixes', () => {
    enabled();
    put(
      '.zephyr/attribution.json',
      '{"schemaVersion":1,"enabled":true,"exclude":["private"]}'
    );
    put('ignored.txt', 'ignored');
    put('.env.local', 'secret');
    put('cert.key', 'secret');
    put('.npmrc', 'secret');
    put('dist/app.js', 'output');
    put('private/file.txt', 'private');
    const record = captureSource(root)!.record!;
    expect(Object.keys(record.files).sort()).toEqual([
      '.gitignore',
      '.zephyr/attribution.json',
      'app.txt',
    ]);
  });
  it('preserves binary and executable changes in an immutable private record', () => {
    enabled();
    const start = captureSource(root, 'build-start')!;
    put('image.bin', '\0binary');
    const summary = finishSourceCapture(root, start, 'version-1')!;
    expect(summary.consistency).toBe('changed-during-build');
    expect(summary.startSourceId).toBe(start.record!.id);
    expect(JSON.stringify(summary)).not.toContain('content');
    const record = loadSourceRecord(root, 'version-1');
    expect(Buffer.from(record.files['image.bin'].content, 'base64').includes(0)).toBe(
      true
    );
    const binaryChange = compareSourceRecords(root, start.record!.id, 'version-1')
      .changes[0];
    expect(binaryChange.binary).toBe(true);
    expect(binaryChange.patch).toContain(
      'Binary files a/image.bin and b/image.bin differ'
    );
    expect(binaryChange.patch).not.toContain('a/before');
    expect(binaryChange.patch).not.toContain('b/after');
    const receipt = readFileSync(
      join(
        root,
        '.git',
        'zephyr-attribution',
        `version-${createHash('sha256').update('version-1').digest('hex')}.json`
      ),
      'utf8'
    );
    expect(finishSourceCapture(root, start, 'version-1')!.status).toBe('unavailable');
    expect(
      readFileSync(
        join(
          root,
          '.git',
          'zephyr-attribution',
          `version-${createHash('sha256').update('version-1').digest('hex')}.json`
        ),
        'utf8'
      )
    ).toBe(receipt);
  });
  it('records matching boundaries separately from publication-only captures', () => {
    enabled();
    const start = captureSource(root, 'build-start')!;
    expect(finishSourceCapture(root, start, 'build-version')!.consistency).toBe(
      'boundary-match'
    );
    expect(finishSourceCapture(root, undefined, 'prebuilt-version')!.consistency).toBe(
      'publication-only'
    );
  });
  it('uses checkpoint models per turn, keeps uninstrumented edits unknown, and rejects stale content', () => {
    enabled();
    const content = 'baseline\nAI turn one\nAI turn two\nknown human\n';
    put('app.txt', content);
    const session = `s_${createHash('sha256').update('codex:fixture-session').digest('hex').slice(0, 14)}`;
    const human = 'Test Contributor <test@example.invalid>';
    const humanId = `h_${createHash('sha256').update(human).digest('hex').slice(0, 14)}`;
    const ranges = [
      { start_line: 2, end_line: 2, author_id: `${session}::t_one` },
      { start_line: 3, end_line: 3, author_id: `${session}::t_two` },
      { start_line: 4, end_line: 4, author_id: humanId },
    ];
    const entry = {
      file: 'app.txt',
      blob_sha: createHash('sha256').update(content).digest('hex'),
      line_attributions: ranges,
    };
    const checkpoints = [
      {
        kind: 'AiAgent',
        agent_id: { tool: 'codex', id: 'fixture-session', model: 'model-one' },
        trace_id: 't_one',
      },
      {
        kind: 'AiAgent',
        agent_id: { tool: 'codex', id: 'fixture-session', model: 'model-two' },
        trace_id: 't_two',
      },
      { kind: 'KnownHuman' },
    ].map((checkpoint) => ({
      ...checkpoint,
      author: human,
      api_version: 'checkpoint/1.0.0',
      git_ai_version: '1.7.5',
      entries: [entry],
    }));
    put(
      `.git/ai/working_logs/${git('rev-parse', 'HEAD')}/checkpoints.jsonl`,
      checkpoints.map((checkpoint) => JSON.stringify(checkpoint)).join('\n') + '\n'
    );
    const record = captureSource(root)!.record!;
    expect(
      record.files['app.txt'].attribution.map(({ origin }) => [origin.kind, origin.model])
    ).toEqual([
      ['ai', 'model-one'],
      ['ai', 'model-two'],
      ['human', undefined],
    ]);
    put('app.txt', `${content}uninstrumented\n`);
    expect(captureSource(root)!.record!.files['app.txt'].attribution).toEqual([]);
    const diff = compareSourceRecords(root, record.id, captureSource(root)!.record!.id);
    expect(diff.changes[0].lines[0].origin.kind).toBe('unknown');
  });
  it('preserves path-like text in context, removed lines, and added lines', () => {
    enabled();
    put('app.txt', 'context a/before b/after\n-- a/before\nold b/after\n');
    const before = captureSource(root)!.record!;
    put('app.txt', 'context a/before b/after\n++ b/after\nnew a/before\n');
    const after = captureSource(root)!.record!;
    const patch = compareSourceRecords(root, before.id, after.id).changes[0].patch;
    expect(patch).toContain('diff --git a/app.txt b/app.txt');
    expect(patch).toContain(' context a/before b/after');
    expect(patch).toContain('--- a/before');
    expect(patch).toContain('+++ b/after');
    expect(patch).toContain('-old b/after');
    expect(patch).toContain('+new a/before');
  });
  it('captures thousands of files with bounded Git processes and batches changed HEAD blobs', () => {
    for (let i = 0; i < 2000; i++) put(`many/${i}.txt`, `file ${i}\n`);
    git('add', '.');
    git('commit', '-qm', 'Large tree');
    enabled();
    put('many/1.txt', 'changed\n');
    rmSync(join(root, 'many/2.txt'));
    const run = rs.mocked(execFileSync);
    run.mockClear();
    try {
      const record = captureSource(root)!.record!;
      const baseline = sourceCommitBaseline(root, record);
      expect(Object.keys(record.files)).toHaveLength(2002);
      expect(Buffer.from(baseline.files['many/1.txt'].content, 'base64').toString()).toBe(
        'file 1\n'
      );
      expect(Buffer.from(baseline.files['many/2.txt'].content, 'base64').toString()).toBe(
        'file 2\n'
      );
      expect(run.mock.calls.length).toBeLessThan(15);
      expect(
        run.mock.calls.filter(([, args]) => (args as string[])[0] === 'cat-file')
      ).toHaveLength(1);
    } finally {
      run.mockClear();
    }
  });
  it('returns unavailable for malformed opt-in configuration', () => {
    put('.zephyr/attribution.json', '{');
    expect(captureSource(root)!.record).toBeUndefined();
    expect(captureSource(root)!.reason).toBeTruthy();
  });

  it('retains explicit committed known-human evidence across later commits', () => {
    put('app.txt', 'instrumented human\nunknown baseline\n');
    git('add', 'app.txt');
    git('commit', '-qm', 'Recorded edit');
    const commit = git('rev-parse', 'HEAD');
    const human = 'Recorded Editor User <editor@example.invalid>';
    const id = `h_${createHash('sha256').update(human).digest('hex').slice(0, 14)}`;
    const note = `app.txt\n  ${id} 1\n---\n${JSON.stringify({
      schema_version: 'authorship/3.0.0',
      git_ai_version: '1.7.5',
      base_commit_sha: commit,
      prompts: {},
      humans: { [id]: { author: human } },
    })}`;
    git('notes', '--ref=ai', 'add', '-m', note, commit);
    put('app.txt', 'instrumented human\nunknown baseline\nlater unknown addition\n');
    git('add', 'app.txt');
    git('commit', '-qm', 'Later commit');
    enabled();
    const before = captureSource(root)!.record!;
    expect(before.files['app.txt'].attribution).toEqual([]);
    put('app.txt', 'unknown baseline\nlater unknown addition\n');
    const after = captureSource(root)!.record!;
    expect(
      compareSourceRecords(root, before.id, after.id).changes[0].lines[0].origin
    ).toEqual({ kind: 'human', human, evidence: 'git-ai-blame' });
    expect(loadSourceRecord(root, before.id).files['app.txt'].attribution).toEqual([]);
  });
});
