import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import {
  attributionRepository,
  captureSource,
  compareSourceRecords,
  readAttributionConfig,
} from 'zephyr-agent';

/** Local receipts and diffs require no Zephyr account or deployment. */
export function attributionCommand(args: string[], cwd: string) {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      directory: { type: 'string', short: 'C', default: '.' },
      format: { type: 'string', default: 'text' },
    },
  });
  const directory = resolve(cwd, values.directory);
  if (values.format !== 'json' && values.format !== 'text')
    throw new Error('--format must be json or text');
  const [action, before, after] = positionals;
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
    const { root } = attributionRepository(directory);
    result = {
      root,
      enabled: readAttributionConfig(root)?.enabled ?? false,
      setup: 'with-zephyr . --attribution --attribution-agents codex',
      integration: 'https://usegitai.com/docs/get-started',
    };
  } else {
    throw new Error(
      'Usage: ze-cli attribution capture|status|compare <before> <after> [-C directory] [--format json|text]'
    );
  }
  // Text is intentionally readable without leaking a capture's private source copy.
  console.log(JSON.stringify(result, null, values.format === 'json' ? undefined : 2));
}
