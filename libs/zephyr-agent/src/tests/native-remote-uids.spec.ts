import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from '@rstest/core';

import { writeNativeRemoteUidsPlugin } from '../index';

const requireFromHere = createRequire(__filename);
let tempDir: string;

afterEach(() => {
  globalThis.__ZEPHYR__ = undefined;
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe('writeNativeRemoteUidsPlugin', () => {
  test('records build-time UIDs in the Zephyr runtime namespace', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'ze-uids-'));
    globalThis.__ZEPHYR__ = undefined;
    const pluginPath = writeNativeRemoteUidsPlugin(tempDir, { host: 'host.p.o' });

    expect(requireFromHere(pluginPath)()).toEqual({ name: 'zephyr-remote-uids' });
    expect(globalThis.__ZEPHYR__?.runtime.remoteApplicationUids).toEqual({
      host: 'host.p.o',
    });
  });

  test('keeps already recorded UIDs while adding newly seeded names', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'ze-uids-'));
    globalThis.__ZEPHYR__ = {
      version: 1,
      runtime: { remoteApplicationUids: { host: 'other' } },
    };
    const pluginPath = writeNativeRemoteUidsPlugin(tempDir, {
      host: 'host.p.o',
      mini: 'mini.p.o',
    });

    requireFromHere(pluginPath)();

    expect(globalThis.__ZEPHYR__?.runtime.remoteApplicationUids).toEqual({
      host: 'other',
      mini: 'mini.p.o',
    });
  });

  test('reuses a path for identical maps and changes path for different maps', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'ze-uids-'));

    const first = writeNativeRemoteUidsPlugin(tempDir, { host: 'host.p.o' });
    const same = writeNativeRemoteUidsPlugin(tempDir, { host: 'host.p.o' });
    const different = writeNativeRemoteUidsPlugin(tempDir, { host: 'other.p.o' });

    expect(same).toBe(first);
    expect(different).not.toBe(first);
  });
});
