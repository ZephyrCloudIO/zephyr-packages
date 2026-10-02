import { afterAll, afterEach, describe, expect, it } from '@rstest/core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createZephyrEnvTransformer } from '../env-transformer';
import { installEnvTransformer } from '../with-zephyr';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zephyr-env-transformer-'));
const stubPath = path.join(tmpDir, 'stub-transformer.js');
fs.writeFileSync(
  stubPath,
  `module.exports = {
    calls: [],
    transform(args) { module.exports.calls.push(args); return { ast: null, src: args.src }; },
    getCacheKey() { return 'stub-key'; },
    extra: 'kept',
  };`
);

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  delete process.env['ZE_PUBLIC_DEMO'];
});

function create(
  applicationUid = 'host.project.org',
  buildEnv = { ZE_PUBLIC_DEMO: 'build' }
) {
  return createZephyrEnvTransformer({
    originalTransformerPath: stubPath,
    applicationUid,
    buildEnv,
    cacheKey: JSON.stringify([applicationUid, buildEnv]),
  });
}

describe('createZephyrEnvTransformer', () => {
  it('delegates app sources with rewritten src and keeps plugins/options', () => {
    const transformer = create();
    const plugins = [['some-plugin', {}]];
    const options = { dev: false, platform: 'ios' };
    const result = transformer.transform({
      filename: 'src/App.js',
      src: 'module.exports = process.env.ZE_PUBLIC_DEMO;',
      plugins,
      options,
    }) as { src: string };

    expect(result.src).toContain(
      'globalThis.__ZEPHYR__?.runtime?.env?.["host.project.org"]'
    );
    expect(result.src).not.toContain('process.env.ZE_PUBLIC_DEMO');
    const call = (require(stubPath).calls as Array<Record<string, unknown>>).at(-1);
    expect(call?.['plugins']).toBe(plugins);
    expect(call?.['options']).toBe(options);
    expect(transformer['extra']).toBe('kept');
  });

  it('delegates node_modules sources untouched', () => {
    const transformer = create();
    const src = 'module.exports = process.env.ZE_PUBLIC_DEMO;';
    const result = transformer.transform({
      filename: '/app/node_modules/lib/index.js',
      src,
    }) as { src: string };

    expect(result.src).toBe(src);
  });

  it('composes the original cache key with its own', () => {
    expect(create().getCacheKey?.()).toBe(
      `stub-key$${JSON.stringify(['host.project.org', { ZE_PUBLIC_DEMO: 'build' }])}`
    );
  });
});

describe('installEnvTransformer', () => {
  it('writes a new transformer module when the UID or build env changes', () => {
    process.env['ZE_PUBLIC_DEMO'] = 'one';
    const base = installEnvTransformer(tmpDir, stubPath, 'host.project.org');
    expect(installEnvTransformer(tmpDir, stubPath, 'host.project.org')).toBe(base);
    expect(installEnvTransformer(tmpDir, stubPath, 'other.project.org')).not.toBe(base);

    process.env['ZE_PUBLIC_DEMO'] = 'two';
    const changed = installEnvTransformer(tmpDir, stubPath, 'host.project.org');
    expect(changed).not.toBe(base);

    expect(path.dirname(base)).toBe(path.join(tmpDir, 'node_modules', '.zephyr-metro'));
    const source = fs.readFileSync(changed, 'utf-8');
    expect(source).toContain('"ZE_PUBLIC_DEMO":"two"');
    expect(source).toContain(JSON.stringify(fs.realpathSync(stubPath)));
    expect(fs.readdirSync(path.dirname(base)).some((f) => f.endsWith('.tmp'))).toBe(
      false
    );
  });
});
