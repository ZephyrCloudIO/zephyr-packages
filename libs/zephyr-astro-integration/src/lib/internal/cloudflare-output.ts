import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isBuiltin } from 'node:module';
import { init, parse } from 'es-module-lexer';
import { buildAssetsMap, type ZeBuildAssetsMap } from 'zephyr-agent';
import type {
  CloudflareDeployment,
  CloudflareDeploymentBinding,
} from 'zephyr-edge-contract';

export interface CloudflareOutput {
  entrypoint: string;
  assetsMap: ZeBuildAssetsMap;
  deployment: CloudflareDeployment;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid Cloudflare ${label}.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value)
    throw new Error(`Missing Cloudflare ${label}.`);
  return value;
}
function strings(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
    throw new Error(`Invalid Cloudflare ${label}.`);
  return value as string[];
}
function configured(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.values(value).some(configured);
  return value !== undefined && value !== null && value !== false && value !== '';
}
function contained(root: string, path: string): string {
  const rel = relative(root, path);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`))
    throw new Error('Cloudflare deployment path is outside the project.');
  return path;
}
const portable = (path: string) => path.split(sep).join('/');

export async function collectCloudflareOutput(
  projectRoot: string
): Promise<CloudflareOutput> {
  const root = await realpath(projectRoot);
  const pointerPath = join(root, '.wrangler/deploy/config.json');
  const pointer = record(
    JSON.parse(await readFile(pointerPath, 'utf8')),
    'deployment pointer'
  );
  const configPath = contained(
    root,
    resolve(dirname(pointerPath), text(pointer['configPath'], 'configPath'))
  );
  contained(root, await realpath(configPath));
  const config = record(
    JSON.parse(await readFile(configPath, 'utf8')),
    'generated config'
  );
  const serverDir = dirname(configPath);
  if (serverDir === root)
    throw new Error('Cloudflare deployment must point to generated server output.');
  const main = contained(
    serverDir,
    resolve(serverDir, text(config['main'], 'entrypoint'))
  );
  if (!/\.[cm]?js$/.test(main))
    throw new Error('Cloudflare entrypoint must be compiled JavaScript.');
  try {
    if (!(await lstat(main)).isFile()) throw new Error('not a file');
  } catch {
    throw new Error('Cloudflare deployment entrypoint is missing or not a regular file.');
  }
  const assetConfig = record(config['assets'], 'assets');
  const clientDir = contained(
    root,
    resolve(serverDir, text(assetConfig['directory'], 'assets.directory'))
  );
  contained(root, await realpath(clientDir));
  const serverToClient = relative(serverDir, clientDir);
  const clientToServer = relative(clientDir, serverDir);
  if (!serverToClient.startsWith(`..${sep}`) || !clientToServer.startsWith(`..${sep}`))
    throw new Error('Cloudflare client assets must be separate from server output.');
  const bindings: CloudflareDeploymentBinding[] = [];
  const names = new Set([text(assetConfig['binding'], 'assets.binding')]);
  function binding(name: unknown, type: CloudflareDeploymentBinding['type']) {
    const key = text(name, 'binding name');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      throw new Error(`Invalid Cloudflare binding name: ${key}`);
    if (names.has(key)) throw new Error(`Duplicate Cloudflare binding: ${key}`);
    names.add(key);
    bindings.push({ name: key, type });
  }
  for (const [field, type] of [
    ['d1_databases', 'd1'],
    ['r2_buckets', 'r2_bucket'],
    ['kv_namespaces', 'kv_namespace'],
  ] as const) {
    const values = config[field];
    if (values === undefined) continue;
    if (!Array.isArray(values)) throw new Error(`Invalid Cloudflare ${field}.`);
    for (const value of values) binding(record(value, field)['binding'], type);
  }
  if (config['images']) binding(record(config['images'], 'images')['binding'], 'images');
  if (config['vars'])
    for (const name of Object.keys(record(config['vars'], 'vars')))
      binding(name, 'plain_text');
  // Required capabilities must not disappear when normalizing generated Wrangler output.
  for (const field of [
    'queues',
    'services',
    'durable_objects',
    'worker_loaders',
    'workflows',
    'hyperdrive',
    'send_email',
    'ai',
    'ai_search',
    'ai_search_namespaces',
    'vectorize',
    'dispatch_namespaces',
    'browser',
    'r2_sql',
    'unsafe',
    'mtls_certificates',
    'ratelimits',
    'secrets_store_secrets',
    'pipelines',
    'agent_memory',
    'artifacts',
    'flagship',
    'vpc_services',
    'vpc_networks',
    'analytics_engine_datasets',
    'connect',
    'migrations',
    'exports',
  ]) {
    const value = config[field];
    if (configured(value))
      throw new Error(`Unsupported Cloudflare deployment capability: ${field}`);
  }
  const runWorkerFirst = assetConfig['run_worker_first'] ?? false;
  if (
    typeof runWorkerFirst !== 'boolean' &&
    (!Array.isArray(runWorkerFirst) || runWorkerFirst.some((v) => typeof v !== 'string'))
  )
    throw new Error('Invalid Cloudflare run_worker_first.');
  const compatibilityDate = text(config['compatibility_date'], 'compatibility_date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate))
    throw new Error('Invalid Cloudflare compatibility_date.');
  const deployment: CloudflareDeployment = {
    schemaVersion: 1,
    compatibilityDate,
    compatibilityFlags: strings(config['compatibility_flags'], 'compatibility_flags'),
    bindings,
    assets: {
      binding: text(assetConfig['binding'], 'assets.binding'),
      directory: 'client',
      runWorkerFirst,
      ...(assetConfig['html_handling'] === undefined
        ? {}
        : { htmlHandling: text(assetConfig['html_handling'], 'html_handling') }),
      ...(assetConfig['not_found_handling'] === undefined
        ? {}
        : {
            notFoundHandling: text(
              assetConfig['not_found_handling'],
              'not_found_handling'
            ),
          }),
    },
    crons: config['triggers']
      ? strings(record(config['triggers'], 'triggers')['crons'], 'crons')
      : [],
  };
  const assets: Record<string, { content: Buffer; type: string }> = {};
  async function walk(
    directory: string,
    mount: 'server' | 'client',
    base: string
  ): Promise<void> {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, item.name);
      if (item.isSymbolicLink())
        throw new Error('Cloudflare deployment output contains a symlink.');
      if (
        (item.name.startsWith('.') && !['.well-known', '.vite'].includes(item.name)) ||
        item.name === 'node_modules'
      )
        continue;
      if (item.isDirectory()) {
        await walk(file, mount, base);
        continue;
      }
      if (!item.isFile())
        throw new Error('Cloudflare output contains a non-regular file.');
      if (
        file === configPath ||
        /(?:^|\/)wrangler\.jsonc?$/.test(portable(file)) ||
        item.name.endsWith('.map')
      )
        continue;
      const key = `${mount}/${portable(relative(base, file))}`;
      const extension = file.split('.').pop() ?? '';
      const types: Record<string, string> = {
        js: 'application/javascript',
        mjs: 'application/javascript',
        cjs: 'application/javascript',
        html: 'text/html',
        css: 'text/css',
        json: 'application/json',
        svg: 'image/svg+xml',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        avif: 'image/avif',
        gif: 'image/gif',
        ico: 'image/x-icon',
        woff: 'font/woff',
        woff2: 'font/woff2',
        txt: 'text/plain',
        xml: 'application/xml',
        wasm: 'application/wasm',
        pdf: 'application/pdf',
      };
      assets[key] = {
        content: await readFile(file),
        type: types[extension] ?? 'application/octet-stream',
      };
    }
  }
  await walk(serverDir, 'server', serverDir);
  await walk(clientDir, 'client', clientDir);
  const entrypoint = `server/${portable(relative(serverDir, main))}`;
  if (!assets[entrypoint])
    throw new Error('Cloudflare entrypoint was excluded from output.');
  await init;
  for (const [path, asset] of Object.entries(assets)) {
    if (!path.startsWith('server/') || !/\.[cm]?js$/.test(path)) continue;
    const [imports] = parse(asset.content.toString());
    for (const imported of imports) {
      const specifier = imported.n;
      if (!specifier || /^(?:cloudflare:|env:)/.test(specifier)) continue;
      if (isBuiltin(specifier) && deployment.compatibilityFlags.includes('nodejs_compat'))
        continue;
      if (!specifier.startsWith('.'))
        throw new Error(
          `Cloudflare server output contains an unbundled import in ${path}: ${specifier}`
        );
      const resolved = portable(relative(root, resolve(root, dirname(path), specifier)));
      if (!resolved.startsWith('server/') || !assets[resolved])
        throw new Error(
          `Cloudflare server module is missing: ${specifier} imported by ${path}`
        );
    }
  }
  return {
    entrypoint,
    deployment,
    assetsMap: buildAssetsMap(
      assets,
      (a) => a.content,
      (a) => a.type
    ),
  };
}
