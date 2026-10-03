import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import type {
  ChangeAttribution,
  ChangeAttributionRange,
  ChangeSession,
} from 'zephyr-edge-contract';
import { committedRanges, readGitAiWorkingAttribution, workingRanges } from './git-ai';
import { readSessionMetadata, sessionForOrigin } from './sessions';

export interface AttributionConfig {
  schemaVersion: 1;
  enabled: boolean;
  gitAiPath?: string;
  /** Repository-relative prefixes to omit, in addition to the built-in exclusions. */
  exclude?: string[];
}
export interface SourceFile {
  hash: string;
  mode: string;
  content: string;
  attribution: ChangeAttributionRange[];
}
export interface SourceRecord {
  schemaVersion: 1;
  id: string;
  fingerprint: string;
  baseCommit: string;
  dirty: boolean;
  capturedAt: string;
  workspaceHuman?: string;
  sessions?: Record<string, ChangeSession>;
  files: Record<string, SourceFile>;
}
export interface SourceCapture {
  phase: 'build-start' | 'publication';
  root: string;
  gitDir: string;
  record?: SourceRecord;
  reason?: string;
}
const digest = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
function git(root: string, args: string[], encoding: 'utf8'): string;
function git(root: string, args: string[], encoding?: undefined): Buffer;
function git(root: string, args: string[], encoding?: 'utf8'): string | Buffer {
  const options = {
    cwd: root,
    timeout: 5000,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'] as ['ignore', 'pipe', 'ignore'],
  };
  return encoding
    ? execFileSync('git', args, { ...options, encoding })
    : execFileSync('git', args, options);
}
export function attributionRepository(directory: string) {
  const root = git(resolve(directory), ['rev-parse', '--show-toplevel'], 'utf8').trim();
  const gitDir = git(root, ['rev-parse', '--absolute-git-dir'], 'utf8').trim();
  return { root, gitDir };
}
export function readAttributionConfig(root: string): AttributionConfig | undefined {
  const filename = join(root, '.zephyr', 'attribution.json');
  if (!existsSync(filename)) return undefined;
  const config = JSON.parse(readFileSync(filename, 'utf8')) as AttributionConfig;
  if (
    config.schemaVersion !== 1 ||
    typeof config.enabled !== 'boolean' ||
    (config.gitAiPath !== undefined && typeof config.gitAiPath !== 'string') ||
    (config.exclude !== undefined &&
      (!Array.isArray(config.exclude) ||
        config.exclude.some((prefix) => typeof prefix !== 'string' || !prefix)))
  ) {
    throw new Error('Invalid .zephyr/attribution.json');
  }
  return config;
}
function excluded(file: string, config: AttributionConfig) {
  return (
    file
      .split('/')
      .some(
        (part) =>
          [
            'node_modules',
            '.git',
            'dist',
            'build',
            '.next',
            '.nuxt',
            '.output',
            '.turbo',
            'coverage',
            '.npmrc',
            '.netrc',
          ].includes(part) ||
          /^\.env(?:\.|$)/.test(part) ||
          /\.(?:pem|key|p12|pfx)$/i.test(part)
      ) ||
    (config.exclude ?? []).some(
      (prefix) => file === prefix || file.startsWith(`${prefix.replace(/\/$/, '')}/`)
    )
  );
}
function privateDirectory(gitDir: string) {
  const directory = join(gitDir, 'zephyr-attribution');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}
/** Opt-in capture. The saved scope is Git-eligible files, not all build inputs. */
export function captureSource(
  directory: string,
  phase: SourceCapture['phase'] = 'publication'
): SourceCapture | undefined {
  let repository: { root: string; gitDir: string };
  try {
    repository = attributionRepository(directory);
  } catch {
    return undefined;
  }
  const { root, gitDir } = repository;
  try {
    const config = readAttributionConfig(root);
    if (!config?.enabled) return undefined;
    let baseCommit = '';
    try {
      baseCommit = git(root, ['rev-parse', '--verify', 'HEAD'], 'utf8').trim();
    } catch {
      /* unborn repo */
    }
    const paths = [
      ...new Set(
        git(
          root,
          ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
          'utf8'
        )
          .split('\0')
          .filter(Boolean)
      ),
    ]
      .filter((file) => !excluded(file, config))
      .sort();
    if (paths.length > 20000)
      throw new Error('Source capture exceeds 20,000 files; configure exclude prefixes');
    const working = readGitAiWorkingAttribution(gitDir, baseCommit);
    const metadata = readSessionMetadata(gitDir);
    const sessions: Record<string, ChangeSession> = Object.create(null);
    const files: Record<string, SourceFile> = Object.create(null);
    let bytes = 0;
    for (const file of paths) {
      const absolute = resolve(root, file);
      if (
        isAbsolute(relative(root, absolute)) ||
        relative(root, absolute).startsWith(`..${sep}`)
      ) {
        throw new Error('Source path escapes repository');
      }
      // Never follow a directory symlink while collecting source.
      const parents = file.split('/').slice(0, -1);
      let parent = root;
      for (const part of parents) {
        parent = join(parent, part);
        if (existsSync(parent) && lstatSync(parent).isSymbolicLink())
          throw new Error('Source parent is a symlink');
      }
      let stat;
      try {
        stat = lstatSync(absolute);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      if (stat.isDirectory())
        throw new Error(`Submodule or directory entry needs an exclusion: ${file}`);
      if (!stat.isFile() && !stat.isSymbolicLink())
        throw new Error(`Unsupported source entry: ${file}`);
      bytes += stat.size;
      if (bytes > 50 * 1024 * 1024)
        throw new Error('Source capture exceeds 50 MiB; configure exclude prefixes');
      const content = stat.isSymbolicLink()
        ? Buffer.from(readlinkSync(absolute))
        : readFileSync(absolute);
      const hash = digest(content);
      const mode = stat.isSymbolicLink()
        ? '120000'
        : stat.mode & 0o111
          ? '100755'
          : '100644';
      let attribution = workingRanges(working.entries.get(file), hash, working.authors);
      // A stale checkpoint must not be patched with HEAD blame: local lines can have moved.
      if (
        attribution === undefined &&
        !working.entries.has(file) &&
        baseCommit &&
        !stat.isSymbolicLink()
      ) {
        try {
          if (digest(git(root, ['show', `${baseCommit}:${file}`])) === hash) {
            attribution = committedRanges(
              root,
              config.gitAiPath ?? 'git-ai',
              file,
              baseCommit
            );
          }
        } catch {
          /* new or deleted file in HEAD */
        }
      }
      for (const range of attribution ?? []) {
        const match = sessionForOrigin(range.origin, metadata);
        if (!match) continue;
        sessions[match.key] = match.session;
        const session = match.session;
        range.origin = {
          ...range.origin,
          agent: session.agent,
          harness: session.harness,
          provider: session.provider,
          reasoningEffort: session.reasoningEffort,
          turn: session.turn,
          turnAssociation: session.turnAssociation,
          promptInitiator: session.promptInitiator,
        };
      }
      files[file] = {
        hash,
        mode,
        content: content.toString('base64'),
        attribution: attribution ?? [],
      };
    }
    const fingerprint = digest(
      JSON.stringify(
        Object.entries(files).map(([file, value]) => [file, value.mode, value.hash])
      )
    );
    let workspaceHuman: string | undefined;
    try {
      workspaceHuman = git(root, ['var', 'GIT_AUTHOR_IDENT'], 'utf8')
        .trim()
        .replace(/ \d+ [+-]\d{4}$/, '');
    } catch {
      /* Git identity unavailable. */
    }
    const record: SourceRecord = {
      schemaVersion: 1,
      id: `source-${randomUUID()}`,
      fingerprint,
      baseCommit,
      dirty: Boolean(
        git(root, ['status', '--porcelain', '--untracked-files=normal'], 'utf8').trim()
      ),
      capturedAt: new Date().toISOString(),
      workspaceHuman,
      sessions,
      files,
    };
    writeFileSync(
      join(privateDirectory(gitDir), `${record.id}.json`),
      JSON.stringify(record),
      { flag: 'wx', mode: 0o600 }
    );
    return { ...repository, phase, record };
  } catch (error) {
    return { ...repository, phase, reason: (error as Error).message };
  }
}

/** Store a version-to-source receipt separately from build assets. */
export function finishSourceCapture(
  directory: string,
  start: SourceCapture | undefined,
  version: string
): ChangeAttribution | undefined {
  const end = captureSource(directory);
  if (!end && !start) return undefined;
  const record = end?.record;
  if (!record)
    return {
      schemaVersion: 1,
      status: 'unavailable',
      reason: end?.reason ?? 'Attribution disabled during build',
      scope: 'git-working-tree',
      consistency: 'unavailable',
      identity: 'self-reported',
    };
  const summary: ChangeAttribution = {
    schemaVersion: 1,
    status: 'captured',
    scope: 'git-working-tree',
    identity: 'self-reported',
    sourceId: record.id,
    sourceFingerprint: record.fingerprint,
    baseCommit: record.baseCommit,
    dirty: record.dirty,
    capturedAt: record.capturedAt,
    workspaceHuman: record.workspaceHuman,
    sessions: record.sessions,
    reason: start?.reason,
    startSourceId: start?.record?.id,
    startSourceFingerprint: start?.record?.fingerprint,
    consistency: start?.reason
      ? 'unavailable'
      : start?.record && start.phase === 'build-start'
        ? start.record.fingerprint === record.fingerprint
          ? 'boundary-match'
          : 'changed-during-build'
        : 'publication-only',
    files: Object.fromEntries(
      Object.entries(record.files).map(([file, value]) => [
        file,
        { hash: value.hash, mode: value.mode, attribution: value.attribution },
      ])
    ),
  };
  try {
    writeFileSync(
      join(privateDirectory(end!.gitDir), `version-${digest(version)}.json`),
      JSON.stringify({ version, summary }),
      { flag: 'wx', mode: 0o600 }
    );
  } catch (error) {
    return {
      schemaVersion: 1,
      status: 'unavailable',
      scope: 'git-working-tree',
      consistency: 'unavailable',
      identity: 'self-reported',
      reason:
        (error as NodeJS.ErrnoException).code === 'EEXIST'
          ? `A source receipt already exists for version ${version}`
          : 'Unable to save the private version receipt',
    };
  }
  return summary;
}

export function loadSourceRecord(directory: string, id: string): SourceRecord {
  const { gitDir } = attributionRepository(directory);
  const storage = privateDirectory(gitDir);
  let sourceId = id;
  if (!/^source-[a-f0-9-]{36}$/.test(id)) {
    const receipt = JSON.parse(
      readFileSync(join(storage, `version-${digest(id)}.json`), 'utf8')
    );
    sourceId = receipt.summary.sourceId;
  }
  if (!/^source-[a-f0-9-]{36}$/.test(sourceId))
    throw new Error('Invalid source record id');
  const record = JSON.parse(
    readFileSync(join(storage, `${sourceId}.json`), 'utf8')
  ) as SourceRecord;
  if (record.schemaVersion !== 1 || record.id !== sourceId)
    throw new Error('Unsupported source record');
  return record;
}
