import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChangeOrigin } from 'zephyr-edge-contract';
import { unknownOrigin } from './git-ai';
import {
  comparisonFile,
  loadSourceRecord,
  type SourceFile,
  type SourceRecord,
} from './source';

export interface AttributedDiffLine {
  operation: 'add' | 'remove';
  line: number;
  text: string;
  /** For removals this identifies original contribution, not the deleting actor. */
  origin: ChangeOrigin;
}
export interface AttributedFileDiff {
  file: string;
  status: 'added' | 'deleted' | 'modified';
  binary: boolean;
  beforeMode?: string;
  afterMode?: string;
  patch: string;
  lines: AttributedDiffLine[];
}
function originAt(file: SourceFile | undefined, line: number) {
  return (
    file?.attribution.find((range) => range.start <= line && range.end >= line)?.origin ??
    unknownOrigin
  );
}
export function compareSourceRecords(directory: string, before: string, after: string) {
  const left = loadSourceRecord(directory, before);
  const right = loadSourceRecord(directory, after);
  return compareSourceContents(left, right, directory);
}

export function compareSourceContents(
  left: SourceRecord,
  right: SourceRecord,
  directory?: string
) {
  const changes: AttributedFileDiff[] = [];
  const temporary = mkdtempSync(join(tmpdir(), 'zephyr-source-diff-'));
  try {
    for (const file of [
      ...new Set([...Object.keys(left.files), ...Object.keys(right.files)]),
    ].sort()) {
      if (
        left.files[file]?.hash === right.files[file]?.hash &&
        left.files[file]?.mode === right.files[file]?.mode
      )
        continue;
      const oldFile = directory
        ? comparisonFile(directory, left, file)
        : left.files[file];
      const newFile = directory
        ? comparisonFile(directory, right, file)
        : right.files[file];
      const oldContent = Buffer.from(oldFile?.content ?? '', 'base64');
      const newContent = Buffer.from(newFile?.content ?? '', 'base64');
      writeFileSync(join(temporary, 'before'), oldContent, { mode: 0o600 });
      writeFileSync(join(temporary, 'after'), newContent, { mode: 0o600 });
      const result = spawnSync(
        'git',
        [
          'diff',
          '--no-index',
          '--no-ext-diff',
          '--no-textconv',
          '--no-color',
          '--unified=3',
          '--',
          'before',
          'after',
        ],
        { cwd: temporary, encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024 * 1024 }
      );
      if (result.error || (result.status !== 0 && result.status !== 1))
        throw result.error ?? new Error(result.stderr);
      const lines: AttributedDiffLine[] = [];
      let oldLine = 0;
      let newLine = 0;
      let inHunk = false;
      for (const line of result.stdout.split('\n')) {
        const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
        if (hunk) {
          oldLine = Number(hunk[1]);
          newLine = Number(hunk[2]);
          inHunk = true;
          continue;
        }
        if (!inHunk) continue;
        if (line.startsWith('+'))
          lines.push({
            operation: 'add',
            line: newLine++,
            text: line.slice(1),
            origin: originAt(newFile, newLine - 1),
          });
        else if (line.startsWith('-'))
          lines.push({
            operation: 'remove',
            line: oldLine++,
            text: line.slice(1),
            origin: originAt(oldFile, oldLine - 1),
          });
        else if (line.startsWith(' ')) {
          oldLine++;
          newLine++;
        }
      }
      const patchLines = result.stdout.split('\n');
      const firstHunk = patchLines.findIndex((entry) => entry.startsWith('@@ '));
      changes.push({
        file,
        status: !oldFile ? 'added' : !newFile ? 'deleted' : 'modified',
        binary: oldContent.includes(0) || newContent.includes(0),
        beforeMode: oldFile?.mode,
        afterMode: newFile?.mode,
        patch: patchLines
          .map((line, index) => {
            if (firstHunk >= 0 && index >= firstHunk) return line;
            if (
              line.startsWith('diff --git ') ||
              line.startsWith('--- ') ||
              line.startsWith('+++ ')
            ) {
              // Header-like text inside a hunk is prefixed by its diff operation.
              // Only the three exact generated headers may be rewritten.
              if (line === 'diff --git a/before b/after')
                return `diff --git a/${file} b/${file}`;
              if (line === '--- a/before') return `--- a/${file}`;
              if (line === '+++ b/after') return `+++ b/${file}`;
            }
            if (line === 'Binary files a/before and b/after differ')
              return `Binary files a/${file} and b/${file} differ`;
            return line;
          })
          .join('\n'),
        lines,
      });
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  return {
    schemaVersion: 1,
    before: left.id,
    after: right.id,
    beforeFingerprint: left.fingerprint,
    afterFingerprint: right.fingerprint,
    sameCommit: left.baseCommit === right.baseCommit,
    changes,
  };
}
