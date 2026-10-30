import { afterAll, beforeAll, describe, expect, it, rs } from '@rstest/core';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// jsonc-parser's UMD build does not bundle under rstest, and no test here reads a JSONC file.
rs.mock('jsonc-parser', () => ({ parse: JSON.parse }));

import { ZephyrError } from 'zephyr-agent';
import { runCommand } from './run';

describe('ze-cli run when no output directory can be detected', () => {
  const savedDisabled = process.env['ZE_DISABLED'];
  let project: string;

  beforeAll(async () => {
    delete process.env['ZE_DISABLED'];
    project = await mkdtemp(path.join(tmpdir(), 'ze-run-skip-'));
    await writeFile(path.join(project, 'package.json'), '{"name":"skip-app"}');
  });

  afterAll(async () => {
    if (savedDisabled === undefined) delete process.env['ZE_DISABLED'];
    else process.env['ZE_DISABLED'] = savedDisabled;
    await rm(project, { recursive: true, force: true });
  });

  it('fails instead of exiting 0 when the build ran and nothing was uploaded', async () => {
    const error = await runCommand({
      commandLine: 'node -e "0"',
      cwd: project,
    }).catch((reason: unknown) => reason);

    expect(ZephyrError.is(error)).toBe(true);
    expect((error as ZephyrError).message).toContain('was not uploaded');
    expect((error as ZephyrError).message).toContain('ze-cli deploy <dir>');
  });
});
