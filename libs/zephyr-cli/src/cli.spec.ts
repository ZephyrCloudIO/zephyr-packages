// BDD description (unit tests are generated from this description):
//
//   Scenario: ze-cli accepts every public build target
//     Given --target worker (also -t worker) with a run command or a deploy directory
//     Then the parsed options carry target "worker"
//
//   Scenario: ze-cli rejects unknown targets
//     Given an unknown or wrongly-cased target such as "WORKER"
//     Then parsing throws "Unsupported Zephyr build target"
//
//   Scenario: the help text lists every target
//     Given --help
//     Then the target line is built from the shared list, including worker
//
//   Scenario: deploy accepts zephyr.config.json flags
//     Given --config, --output, --dry-run and repeatable --include and --exclude
//     Then the parsed options carry them; repeated flags are collected in order
//
//   Scenario: deploy-only flags are rejected elsewhere or without a value
//     Given one of those flags with run or watch, or with no value
//     Then parsing throws
//
//   Scenario: the help text documents the flags, the denylist and the refusals
//
//   Scenario: deploy rejects what it does not understand
//     Given a mistyped flag such as --dry-ryn, or a second positional argument
//     Then parsing throws instead of ignoring it, so a dry run never becomes an upload
//     And watch keeps ignoring unknown options, as before
//
//   Scenario: value flags accept --flag=value
//     Given --config=, --output=, --include=, --exclude=, --target=, --format= or
//       --metadata= on deploy
//     Then the values are parsed as with the separate form
//     And a switch given a value (--dry-run=yes) is rejected
//
// The remaining scenarios are described by the test names in this file.
import { describe, expect, it, rs } from '@rstest/core';
import { isJsonDeploy, parseArgs } from './cli';

/** Makes `process.exit` throw, so help and usage paths can be asserted. */
function mockProcessExit(): ReturnType<typeof rs.spyOn> {
  return rs.spyOn(process, 'exit').mockImplementation((): never => {
    throw new Error('exit');
  });
}

describe('parseArgs build target', () => {
  it('accepts worker before a run command', () => {
    expect(parseArgs(['--target', 'worker', 'pnpm', 'build'])).toMatchObject({
      command: 'run',
      commandLine: 'pnpm build',
      target: 'worker',
    });
  });

  it('accepts worker after a deploy directory, also through -t', () => {
    expect(parseArgs(['deploy', './dist', '--target', 'worker'])).toMatchObject({
      command: 'deploy',
      directory: './dist',
      target: 'worker',
    });
    expect(parseArgs(['deploy', './dist', '-t', 'worker'])).toMatchObject({
      target: 'worker',
    });
  });

  it('rejects a wrongly-cased or missing worker target', () => {
    expect(() => parseArgs(['deploy', './dist', '--target', 'WORKER'])).toThrow(
      'Unsupported Zephyr build target: WORKER'
    );
    expect(() => parseArgs(['deploy', './dist', '--target'])).toThrow(
      'Unsupported Zephyr build target: undefined'
    );
  });

  it('lists every build target, including worker, in the help text', () => {
    const log = rs.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = mockProcessExit();
    try {
      expect(() => parseArgs(['--help'])).toThrow('exit');
      expect(log.mock.calls.flat().join('\n')).toContain(
        'Build target: web, ios, android, tap-app, or worker (default: web)'
      );
    } finally {
      log.mockRestore();
      exit.mockRestore();
    }
  });

  it('accepts tap-app before a run command', () => {
    expect(parseArgs(['--target', 'tap-app', 'pnpm', 'build'])).toMatchObject({
      command: 'run',
      commandLine: 'pnpm build',
      target: 'tap-app',
    });
  });

  it('accepts tap-app after a deploy directory', () => {
    expect(parseArgs(['deploy', './dist', '--target', 'tap-app'])).toMatchObject({
      command: 'deploy',
      directory: './dist',
      target: 'tap-app',
    });
  });

  it('accepts a tap-app output watch with a debounce', () => {
    expect(
      parseArgs(['watch', './dist', '--target', 'tap-app', '--debounce', '500'])
    ).toMatchObject({
      command: 'watch',
      directory: './dist',
      target: 'tap-app',
      debounceMs: 500,
    });
  });

  it('accepts a metadata sidecar before a run command and after directory commands', () => {
    expect(
      parseArgs([
        '--target',
        'tap-app',
        '--metadata',
        './dist/zephyr-publication.json',
        'pnpm',
        'build',
      ])
    ).toMatchObject({
      command: 'run',
      commandLine: 'pnpm build',
      metadataPath: './dist/zephyr-publication.json',
    });
    expect(
      parseArgs([
        'watch',
        './dist',
        '--target',
        'tap-app',
        '--metadata',
        './dist/zephyr-publication.json',
      ])
    ).toMatchObject({
      command: 'watch',
      metadataPath: './dist/zephyr-publication.json',
    });
  });

  it('rejects a metadata flag without a sidecar path', () => {
    expect(() => parseArgs(['deploy', './dist', '--metadata'])).toThrow(
      '--metadata requires a JSON sidecar path'
    );
  });

  it('rejects an unsupported directory-command target instead of silently dropping it', () => {
    expect(() => parseArgs(['deploy', './dist', '--target', 'unknown-target'])).toThrow(
      'Unsupported Zephyr build target: unknown-target'
    );
  });

  it('rejects an unsupported leading target instead of silently defaulting to web', () => {
    expect(() => parseArgs(['--target', 'unknown-target', 'pnpm', 'build'])).toThrow(
      'Unsupported Zephyr build target: unknown-target'
    );
  });
});

describe('parseArgs doctor', () => {
  it('defaults to the current directory and text output', () => {
    expect(parseArgs(['doctor'])).toMatchObject({
      command: 'doctor',
      directory: '.',
      format: 'text',
    });
  });

  it('accepts an optional directory and JSON output', () => {
    expect(parseArgs(['doctor', './apps/host', '--format', 'json'])).toMatchObject({
      command: 'doctor',
      directory: './apps/host',
      format: 'json',
    });
  });

  it('rejects unsupported doctor formats and flags', () => {
    expect(() => parseArgs(['doctor', '--format', 'yaml'])).toThrow(
      '--format must be either json or text'
    );
    expect(() => parseArgs(['doctor', '--write'])).toThrow(
      'Unknown doctor option: --write'
    );
  });
});

describe('parseArgs doctor --online', () => {
  it('stays offline unless --online is given', () => {
    expect(parseArgs(['doctor'])).not.toHaveProperty('online');
    expect(parseArgs(['doctor'])).not.toHaveProperty('timeoutMs');
  });

  it('accepts --online with a directory, a format and a timeout', () => {
    expect(
      parseArgs(['doctor', './app', '--online', '--timeout', '2500', '--format', 'json'])
    ).toMatchObject({
      command: 'doctor',
      directory: './app',
      format: 'json',
      online: true,
      timeoutMs: 2500,
    });
  });

  it('rejects a timeout that is missing, not whole, or out of range', () => {
    for (const value of ['0', '-1', '1.5', 'abc', '60001']) {
      expect(() => parseArgs(['doctor', '--online', '--timeout', value])).toThrow(
        '--timeout must be an integer from 1 to 60000'
      );
    }
    expect(() => parseArgs(['doctor', '--online', '--timeout'])).toThrow(
      '--timeout must be an integer'
    );
  });

  it('rejects --timeout without --online', () => {
    expect(() => parseArgs(['doctor', '--timeout', '100'])).toThrow(
      '--timeout can only be used with --online'
    );
  });
});

describe('parseArgs deploy result format', () => {
  it('accepts a json result format for deploy', () => {
    expect(parseArgs(['deploy', './dist', '--format', 'json'])).toMatchObject({
      command: 'deploy',
      directory: './dist',
      format: 'json',
    });
    expect(() => parseArgs(['deploy', './dist', '--format', 'yaml'])).toThrow(
      '--format must be either json or text.'
    );
  });
});

describe('isJsonDeploy', () => {
  it('detects deploy with --format json, before or after other options', () => {
    expect(isJsonDeploy(['deploy', './dist', '--format', 'json'])).toBe(true);
    expect(
      isJsonDeploy(['--target', 'web', 'deploy', './dist', '--format', 'json'])
    ).toBe(true);
  });

  it('ignores other commands and text output', () => {
    expect(isJsonDeploy(['deploy', './dist'])).toBe(false);
    expect(isJsonDeploy(['deploy', 'd', '--format', 'json', '--format', 'text'])).toBe(
      false
    );
    expect(isJsonDeploy(['deploy', './dist', '--format', 'text'])).toBe(false);
    expect(isJsonDeploy(['deploy', '--format', 'json'])).toBe(false);
    expect(isJsonDeploy(['doctor', '.', '--format', 'json'])).toBe(false);
    expect(isJsonDeploy(['npm', 'run', 'deploy', '--format', 'json'])).toBe(false);
  });
});

describe('parseArgs deploy configuration flags', () => {
  it('parses --config, --output, --dry-run and repeatable --include and --exclude', () => {
    expect(
      parseArgs([
        'deploy',
        './dist',
        '--config',
        'c.json',
        '--output',
        'out',
        '--include',
        'a/**',
        '--include',
        'b/**',
        '--exclude',
        '**/*.css',
        '--dry-run',
      ])
    ).toMatchObject({
      command: 'deploy',
      configPath: 'c.json',
      output: 'out',
      include: ['a/**', 'b/**'],
      exclude: ['**/*.css'],
      dryRun: true,
    });
  });

  it('leaves the options unset when no flag is given', () => {
    const options = parseArgs(['deploy', './dist']);
    expect(options.include).toBeUndefined();
    expect(options.dryRun).toBeUndefined();
  });

  it('rejects the flags for watch and run', () => {
    expect(() => parseArgs(['watch', './dist', '--dry-run'])).toThrow(
      /only be used with the deploy/
    );
    expect(() => parseArgs(['--dry-run', 'pnpm', 'build'])).toThrow(
      /only be used with the deploy/
    );
  });

  it('rejects a missing value', () => {
    expect(() => parseArgs(['deploy', './dist', '--include'])).toThrow(
      /requires a value/
    );
    expect(() => parseArgs(['deploy', './dist', '--config', '--dry-run'])).toThrow(
      /requires a value/
    );
  });

  it('skips the values of the new flags when detecting json deploy', () => {
    expect(
      isJsonDeploy([
        'deploy',
        './dist',
        '--include',
        'x',
        '--format',
        'json',
        '--dry-run',
      ])
    ).toBe(true);
  });

  it('documents the flags in the help text', () => {
    const log = rs.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = mockProcessExit();
    expect(() => parseArgs(['--help'])).toThrow('exit');
    const help = String(log.mock.calls[0]?.[0]);
    for (const text of [
      '--dry-run',
      '--include',
      '--exclude',
      '--config',
      '--output',
      'never uploaded',
      'wrangler',
    ]) {
      expect(help).toContain(text);
    }
    log.mockRestore();
    exit.mockRestore();
  });
});

describe('parseArgs deploy strictness', () => {
  it('rejects a mistyped flag instead of ignoring it', () => {
    expect(() => parseArgs(['deploy', './dist', '--dry-ryn'])).toThrow(
      'Unknown deploy option: --dry-ryn'
    );
    expect(() => parseArgs(['deploy', './dist', '-x'])).toThrow(
      'Unknown deploy option: -x'
    );
  });

  it('rejects a second positional argument', () => {
    expect(() => parseArgs(['deploy', './dist', './other'])).toThrow(
      /Unexpected extra argument: \.\/other/
    );
  });

  it('accepts the --flag=value form', () => {
    expect(
      parseArgs([
        'deploy',
        './dist',
        '--config=a.json',
        '--output=out',
        '--include=*.js',
        '--exclude=*.map',
        '--target=worker',
        '--format=json',
        '--metadata=m.json',
        '--dry-run',
      ])
    ).toMatchObject({
      configPath: 'a.json',
      output: 'out',
      include: ['*.js'],
      exclude: ['*.map'],
      target: 'worker',
      format: 'json',
      metadataPath: 'm.json',
      dryRun: true,
    });
  });

  it('keeps an equals sign inside the value', () => {
    expect(parseArgs(['deploy', './dist', '--include=a=b/**'])).toMatchObject({
      include: ['a=b/**'],
    });
  });

  it('rejects an empty or invalid value in the = form', () => {
    expect(() => parseArgs(['deploy', './dist', '--include='])).toThrow(
      '--include requires a value.'
    );
    expect(() => parseArgs(['deploy', './dist', '--target=nope'])).toThrow(
      'Unsupported Zephyr build target: nope'
    );
    expect(() => parseArgs(['deploy', './dist', '--format=xml'])).toThrow(
      '--format must be either json or text.'
    );
  });

  it('rejects a switch given a value', () => {
    expect(() => parseArgs(['deploy', './dist', '--dry-run=yes'])).toThrow(
      'Unknown deploy option: --dry-run=yes'
    );
  });

  it('keeps ignoring unknown options for watch', () => {
    expect(parseArgs(['watch', './dist', '--whatever'])).toMatchObject({
      command: 'watch',
      directory: './dist',
    });
  });

  it('detects json deploy in the = form', () => {
    expect(isJsonDeploy(['deploy', './dist', '--format=json'])).toBe(true);
    expect(isJsonDeploy(['deploy', './dist', '--format=text'])).toBe(false);
  });
});
