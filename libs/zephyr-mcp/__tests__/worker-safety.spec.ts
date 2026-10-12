import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { rspack } from '@rslib/core';
import { afterAll, describe, expect, it } from '@rstest/core';

const src = path.resolve(import.meta.dirname, '../src');

// The entry points the Zephyr MCP and provider isolates load in Workers.
const workerEntries = {
  index: './index.ts',
  worker: './worker/index.ts',
  manifest: './manifest/index.ts',
};

// A module reference (import, export-from, import() or require), not prose:
// the bundle keeps comments that mention node:*.
const FORBIDDEN =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'`](?:node:|cloudflare:)/;

describe('Worker-safe entry points', () => {
  let out = '';
  afterAll(async () => {
    if (out) await rm(out, { recursive: true, force: true });
  });

  it('bundle for a web worker without node:* or cloudflare:*', async () => {
    out = await mkdtemp(path.join(os.tmpdir(), 'mcp-worker-safety-'));
    await new Promise<void>((resolve, reject) => {
      rspack({
        mode: 'production',
        context: src,
        target: ['webworker', 'es2022'],
        entry: workerEntries,
        resolve: { extensions: ['.ts', '.js'] },
        output: {
          path: out,
          filename: '[name].js',
          module: true,
          library: { type: 'module' },
        },
        optimization: { minimize: false },
        module: {
          rules: [
            {
              test: /\.ts$/,
              loader: 'builtin:swc-loader',
              options: { jsc: { parser: { syntax: 'typescript' } } },
              type: 'javascript/auto',
            },
          ],
        },
      }).run((error, stats) => {
        if (error) return reject(error);
        if (stats?.hasErrors()) {
          return reject(new Error(stats.toString('errors-only')));
        }
        resolve();
      });
    });
    const files = (await readdir(out)).filter((file) => file.endsWith('.js'));
    expect(files.sort()).toEqual(
      Object.keys(workerEntries)
        .map((name) => `${name}.js`)
        .sort()
    );
    for (const file of files) {
      const source = await readFile(path.join(out, file), 'utf8');
      expect({ file, forbidden: FORBIDDEN.exec(source)?.[0] }).toEqual({
        file,
        forbidden: undefined,
      });
    }
  }, 60_000);
});

// Static imports only: `import()` inside a function is loaded on first use.
const STATIC_IMPORT =
  /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;

const resolveSource = async (from: string, specifier: string) => {
  const base = path.resolve(path.dirname(from), specifier);
  for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
    if (
      await readFile(candidate).then(
        () => true,
        () => false
      )
    )
      return candidate;
  }
  throw new Error(`Cannot resolve ${specifier} from ${from}`);
};

const staticGraph = async (entry: string) => {
  const seen = new Set<string>();
  const external = new Set<string>();
  const visit = async (file: string): Promise<void> => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = await readFile(file, 'utf8');
    for (const [, specifier = ''] of source.matchAll(STATIC_IMPORT)) {
      if (specifier.startsWith('.')) await visit(await resolveSource(file, specifier));
      else external.add(specifier);
    }
  };
  await visit(path.join(src, entry));
  return external;
};

describe('the import graph', () => {
  it.each(Object.values(workerEntries))(
    '%s statically reaches only zod and yaml',
    async (entry) => {
      const external = [...(await staticGraph(entry))];
      expect(external.filter((name) => name !== 'zod' && name !== 'yaml')).toEqual([]);
    }
  );

  it('catches a forbidden reference', () => {
    expect(FORBIDDEN.test('import vm from "node:vm";')).toBe(true);
    expect(FORBIDDEN.test('await import("cloudflare:sockets")')).toBe(true);
    expect(FORBIDDEN.test('/* no `node:*` imports */')).toBe(false);
  });

  it('is detected by the graph walker', async () => {
    expect(await staticGraph('rslib/index.ts')).toContain('node:fs/promises');
  });
});
