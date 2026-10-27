import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

import { writeNativeEnvRuntimePlugin } from './native-env-runtime-module';

let outDir = '';

beforeEach(() => {
  outDir = mkdtempSync(path.join(os.tmpdir(), 'ze-env-plugin-'));
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('writeNativeEnvRuntimePlugin', () => {
  it('writes nothing when no dependency resolved', () => {
    expect(writeNativeEnvRuntimePlugin(outDir, null)).toBeUndefined();
    expect(writeNativeEnvRuntimePlugin(outDir, [])).toBeUndefined();
    expect(readdirSync(outDir)).toEqual([]);
  });

  it('binds the remote UID map to the env runtime plugin', () => {
    const file = writeNativeEnvRuntimePlugin(outDir, [
      { name: 'host', application_uid: 'host.p.o' },
    ]);
    if (!file) throw new Error('expected a generated module');

    const required: string[] = [];
    const fakeRequire = (request: string) => {
      required.push(request);
      return {
        createNativeEnvRuntimePlugin: (uids: Record<string, string>) => ({
          name: 'stub',
          uids,
        }),
      };
    };
    const module = { exports: {} as unknown };
    vm.runInNewContext(readFileSync(file, 'utf8'), { module, require: fakeRequire });

    expect((module.exports as () => unknown)()).toEqual({
      name: 'stub',
      uids: { host: 'host.p.o' },
    });
    expect(required).toHaveLength(1);
    expect(required[0]?.endsWith(path.join('runtime', 'env-runtime-plugin.js'))).toBe(
      true
    );
  });

  it('names the file by its content', () => {
    const first = writeNativeEnvRuntimePlugin(outDir, [
      { name: 'host', application_uid: 'host.p.o' },
    ]);
    const again = writeNativeEnvRuntimePlugin(outDir, [
      { name: 'host', application_uid: 'host.p.o' },
    ]);
    const other = writeNativeEnvRuntimePlugin(outDir, [
      { name: 'host', application_uid: 'other.p.o' },
    ]);

    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });
});
