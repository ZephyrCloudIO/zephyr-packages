import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { PassThrough } from 'node:stream';
import * as readline from 'node:readline';
import { reserveStdout } from './stdout';

describe('reserveStdout', () => {
  const originalWrite = process.stdout.write;

  afterEach(() => {
    process.stdout.write = originalWrite;
    rs.restoreAllMocks();
  });

  it('keeps login prompts and stray writes off stdout and writes the result there', () => {
    const stdout = rs.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = rs.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const writeResult = reserveStdout();

    // Mirrors the interactive login prompt, which writes to process.stdout directly.
    const rl = readline.createInterface({
      input: new PassThrough(),
      output: process.stdout,
      terminal: false,
    });
    rl.question('Hit Enter to open it in your browser.', () => undefined);
    rl.close();
    process.stdout.write('stray\n');
    writeResult('{"applicationUid":"app.project.org"}\n');

    expect(stdout.mock.calls.map(([text]) => text)).toEqual([
      '{"applicationUid":"app.project.org"}\n',
    ]);
    expect(stderr.mock.calls.map(([text]) => text)).toEqual(
      expect.arrayContaining(['Hit Enter to open it in your browser.', 'stray\n'])
    );
  });
});
