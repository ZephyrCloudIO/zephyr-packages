import { afterAll, afterEach, describe, expect, it } from '@rstest/core';
import fs from 'node:fs';
import { createRequire } from 'node:module';
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
    getCacheKey(options) { return 'stub-key:' + (options ? options.projectRoot : ''); },
    extra: 'kept',
  };`
);
// Metro requires `babelTransformerPath` itself; this module hands it the transformer
// under test.
const workerTransformerPath = path.join(tmpDir, 'worker-transformer.js');
fs.writeFileSync(workerTransformerPath, 'module.exports = globalThis.__zeTransformer;');

const metroRequire = createRequire(require.resolve('metro/package.json'));
const metroBabelTransformerPath = metroRequire.resolve('metro-babel-transformer');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  delete process.env['ZE_PUBLIC_DEMO'];
});

function create(
  originalTransformerPath = stubPath,
  applicationUid = 'host.project.org',
  buildEnv = { ZE_PUBLIC_DEMO: 'build' }
) {
  return createZephyrEnvTransformer({
    originalTransformerPath,
    applicationUid,
    buildEnv,
    cacheKey: JSON.stringify([applicationUid, buildEnv]),
  });
}

function lastStubCall(): Record<string, unknown> | undefined {
  return (require(stubPath).calls as Array<Record<string, unknown>>).at(-1);
}

/** Runs one file through Metro's transform worker with the env transformer installed. */
async function transformWithMetro(
  filename: string,
  src: string,
  hermesParser = false
): Promise<{ code: string; map: unknown }> {
  (globalThis as Record<string, unknown>)['__zeTransformer'] = create(
    metroBabelTransformerPath
  );
  const { getDefaultConfig } = require('metro-config');
  const { transform } = require('metro-transform-worker');
  const { transformer } = await getDefaultConfig(tmpDir);
  const result = await transform(
    {
      ...transformer,
      babelTransformerPath: workerTransformerPath,
      hermesParser,
      enableBabelRCLookup: false,
      enableBabelRuntime: false,
    },
    tmpDir,
    filename,
    Buffer.from(src),
    {
      dev: true,
      hot: false,
      inlinePlatform: false,
      inlineRequires: false,
      minify: false,
      platform: 'ios',
      type: 'module',
      unstable_transformProfile: 'default',
      experimentalImportSupport: false,
      customTransformOptions: {},
    }
  );
  return result.output[0].data;
}

/** 1-based line and 0-based column of `needle` in `text`. */
function position(text: string, needle: string): [number, number] {
  const lines = text.slice(0, text.indexOf(needle)).split('\n');
  return [lines.length, lines.at(-1)?.length ?? 0];
}

describe('createZephyrEnvTransformer', () => {
  it('adds its Babel plugin first and keeps plugins/options', () => {
    const transformer = create();
    const plugin = ['some-plugin', {}];
    const options = { dev: false, platform: 'ios' };
    const src = 'module.exports = process.env.ZE_PUBLIC_DEMO;';
    transformer.transform({ filename: 'src/App.js', src, plugins: [plugin], options });

    const call = lastStubCall();
    expect(call?.['src']).toBe(src);
    expect(call?.['options']).toBe(options);
    const plugins = call?.['plugins'] as unknown[];
    expect(plugins).toHaveLength(2);
    expect(plugins[1]).toBe(plugin);
    expect(transformer['extra']).toBe('kept');
  });

  it('delegates node_modules sources and sources without env reads untouched', () => {
    const transformer = create();
    const plugins = [['some-plugin', {}]];
    for (const args of [
      {
        filename: '/app/node_modules/lib/index.js',
        src: 'module.exports = process.env.ZE_PUBLIC_DEMO;',
        plugins,
      },
      { filename: 'src/App.js', src: 'module.exports = process.env.NODE_ENV;', plugins },
    ]) {
      transformer.transform(args);
      expect(lastStubCall()).toEqual(args);
    }
  });

  it('forwards cache key options and composes the original key with its own', () => {
    expect(
      create().getCacheKey?.({ projectRoot: '/app', enableBabelRCLookup: true })
    ).toBe(
      `stub-key:/app$${JSON.stringify(['host.project.org', { ZE_PUBLIC_DEMO: 'build' }])}`
    );
  });

  it('rewrites reads in Metro output and keeps original source positions', async () => {
    const src = 'const endpoint = process.env.ZE_PUBLIC_DEMO; throw new Error("boom");';
    const { code, map } = await transformWithMetro('src/App.js', src);

    expect(code).toContain('globalThis.__ZEPHYR__?.runtime?.env?.["host.project.org"]');
    expect(code).not.toContain('process.env.ZE_PUBLIC_DEMO');
    const { Consumer, fromRawMappings } = require('metro-source-map');
    const sourceMap = fromRawMappings([
      { code, map, source: src, path: 'src/App.js', functionMap: null, isIgnored: false },
    ]).toMap();
    const [line, column] = position(code, 'throw');
    const original = new Consumer(sourceMap).originalPositionFor({ line, column });
    expect([original.line, original.column]).toEqual([1, src.indexOf('throw')]);
  });

  it('rewrites reads in Flow component declarations parsed by Metro', async () => {
    const src = [
      '// @flow',
      'component App() { return process.env.ZE_PUBLIC_DEMO; }',
    ].join('\n');
    const { code } = await transformWithMetro('src/App.js', src, true);

    expect(code).toContain('globalThis.__ZEPHYR__?.runtime?.env?.["host.project.org"]');
    expect(code).not.toContain('process.env.ZE_PUBLIC_DEMO');
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
