import { parseArgs } from 'node:util';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  attributionRepository,
  captureSource,
  compareSourceRecords,
  createLocalAttributionReport,
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
      output: { type: 'string' },
      local: { type: 'boolean', default: false },
    },
  });
  const directory = resolve(cwd, values.directory);
  if (values.format !== 'json' && values.format !== 'text')
    throw new Error('--format must be json or text');
  const [action, before, after] = positionals;
  if (action !== 'configure' && (values.storage || values.local))
    throw new Error('Configuration flags require attribution configure');
  if (action !== 'report' && values.output)
    throw new Error('--output requires attribution report');
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
  } else if (action === 'report' && positionals.length === 3) {
    const report = createLocalAttributionReport(directory, before, after);
    const { gitDir } = attributionRepository(directory);
    // Default to private storage, outside ordinary deployment output and Git tracking.
    const output = values.output
      ? resolve(cwd, values.output)
      : join(gitDir, 'zephyr-attribution', `report-${randomUUID()}.json`);
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    result = {
      output,
      message:
        'Open Activity > Contributors in Zephyr and choose this file in Local attribution report. The SDK does not upload it.',
    };
  } else if (action === 'status' && positionals.length === 1) {
    const { root, gitDir } = attributionRepository(directory);
    const config = readAttributionConfig(root, gitDir);
    result = {
      root,
      enabled: config?.enabled ?? false,
      storage: config?.storage ?? 'local',
      report: 'ze-cli attribution report <before> <after>',
      setup: 'with-zephyr . --attribution --attribution-agents codex',
      integration: 'https://usegitai.com/docs/get-started',
    };
  } else if (action === 'configure' && positionals.length === 1) {
    if (values.storage !== 'local')
      throw new Error('Attribution is local-only; configure requires --storage local');
    const { root, gitDir } = attributionRepository(directory);
    const existing = readAttributionConfig(root);
    if (!existing?.enabled)
      throw new Error(
        'Enable repository attribution with with-zephyr . --attribution before configuring storage'
      );
    const config = {
      ...existing,
      storage: 'local' as const,
      ...(values.local ? { content: undefined } : {}),
    };
    writeAttributionConfig(root, gitDir, config, values.local);
    result = {
      root,
      ...readAttributionConfig(root, gitDir),
      privateOverride: values.local,
    };
  } else {
    throw new Error(
      'Usage: ze-cli attribution capture|status|compare <before> <after>|report <before> <after> [--output file.json]|configure --storage local [--local] [-C directory] [--format json|text]'
    );
  }
  // Text is intentionally readable without leaking a capture's private source copy.
  console.log(JSON.stringify(result, null, values.format === 'json' ? undefined : 2));
}
