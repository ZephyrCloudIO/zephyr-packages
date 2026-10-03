import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import {
  attributionRepository,
  captureSource,
  compareSourceRecords,
  readAttributionConfig,
  writeAttributionConfig,
} from 'zephyr-agent';

/** Local receipts and diffs require no Zephyr account or deployment. */
export function attributionCommand(args: string[], cwd: string) {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      directory: { type: 'string', short: 'C', default: '.' },
      format: { type: 'string', default: 'text' },
      storage: { type: 'string' },
      patches: { type: 'string' },
      lines: { type: 'string' },
      'repository-id': { type: 'string' },
      local: { type: 'boolean', default: false },
    },
  });
  const directory = resolve(cwd, values.directory);
  if (values.format !== 'json' && values.format !== 'text')
    throw new Error('--format must be json or text');
  const [action, before, after] = positionals;
  if (
    action !== 'configure' &&
    (values.storage ||
      values.patches ||
      values.lines ||
      values['repository-id'] ||
      values.local)
  )
    throw new Error('Configuration flags require attribution configure');
  let result: unknown;
  if (action === 'capture' && positionals.length === 1) {
    const capture = captureSource(directory);
    if (!capture?.record)
      throw new Error(
        capture?.reason ?? 'Enable Change Attribution with: with-zephyr . --attribution'
      );
    result = {
      sourceId: capture.record.id,
      fingerprint: capture.record.fingerprint,
      baseCommit: capture.record.baseCommit,
      dirty: capture.record.dirty,
      files: Object.keys(capture.record.files).length,
    };
  } else if (action === 'compare' && positionals.length === 3) {
    result = compareSourceRecords(directory, before, after);
  } else if (action === 'status' && positionals.length === 1) {
    const { root, gitDir } = attributionRepository(directory);
    const config = readAttributionConfig(root, gitDir);
    result = {
      root,
      enabled: config?.enabled ?? false,
      storage: config?.storage ?? 'local',
      content: config?.content ?? {},
      repositoryId: config?.repositoryId,
      setup: 'with-zephyr . --attribution --attribution-agents codex',
      integration: 'https://usegitai.com/docs/get-started',
    };
  } else if (action === 'configure' && positionals.length === 1) {
    if (!['local', 'remote'].includes(values.storage ?? ''))
      throw new Error('configure requires --storage local|remote');
    const flag = (value: string | undefined) => {
      if (value === undefined) return undefined;
      if (!['include', 'omit'].includes(value))
        throw new Error('Use include or omit for --patches and --lines');
      return value === 'include';
    };
    const { root, gitDir } = attributionRepository(directory);
    if (values.local && !readAttributionConfig(root)?.enabled)
      throw new Error('Enable repository attribution before adding a private override');
    const existing = readAttributionConfig(root) ?? {
      schemaVersion: 1 as const,
      enabled: true,
    };
    const config = {
      ...existing,
      storage: values.storage as 'local' | 'remote',
      ...(values['repository-id'] ? { repositoryId: values['repository-id'] } : {}),
      content: {
        ...(values.local ? {} : existing.content),
        ...(values.patches ? { patch: flag(values.patches) } : {}),
        ...(values.lines ? { lines: flag(values.lines) } : {}),
      },
    };
    writeAttributionConfig(root, gitDir, config, values.local);
    result = {
      root,
      ...readAttributionConfig(root, gitDir),
      privateOverride: values.local,
    };
  } else {
    throw new Error(
      'Usage: ze-cli attribution capture|status|compare <before> <after>|configure --storage local|remote [--patches include|omit] [--lines include|omit] [--local] [-C directory] [--format json|text]'
    );
  }
  // Text is intentionally readable without leaking a capture's private source copy.
  console.log(JSON.stringify(result, null, values.format === 'json' ? undefined : 2));
}
