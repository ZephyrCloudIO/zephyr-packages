import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectCloudflareOutput } from './cloudflare-output';

describe('Cloudflare Astro output', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'zephyr-astro-worker-'));
    await mkdir(join(root, '.wrangler/deploy'), { recursive: true });
    await mkdir(join(root, 'dist/server/chunks'), { recursive: true });
    await mkdir(join(root, 'dist/client/_astro'), { recursive: true });
    await writeFile(
      join(root, '.wrangler/deploy/config.json'),
      JSON.stringify({ configPath: '../../dist/server/wrangler.json' })
    );
    await writeFile(
      join(root, 'dist/server/index.js'),
      'import "./chunks/app.js"; export default {fetch() {return new Response("hello")}}'
    );
    await writeFile(join(root, 'dist/server/chunks/app.js'), 'export const app = true;');
    await writeFile(join(root, 'dist/client/_astro/admin.js'), 'console.log("admin")');
    await writeFile(join(root, 'dist/client/index.html'), '<h1>home</h1>');
    await writeConfig({});
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  async function writeConfig(extra: Record<string, unknown>) {
    await writeFile(
      join(root, 'dist/server/wrangler.json'),
      JSON.stringify({
        main: 'index.js',
        compatibility_date: '2026-10-28',
        compatibility_flags: ['nodejs_compat'],
        assets: { directory: '../client', binding: 'ASSETS' },
        ...extra,
      })
    );
  }
  it('collects server chunks and all client output rather than a page-only asset list', async () => {
    const output = await collectCloudflareOutput(root);
    expect(output.entrypoint).toBe('server/index.js');
    expect(
      Object.values(output.assetsMap)
        .map((a) => a.path)
        .sort()
    ).toEqual([
      'client/_astro/admin.js',
      'client/index.html',
      'server/chunks/app.js',
      'server/index.js',
    ]);
    expect(
      Object.values(output.assetsMap)
        .find((a) => a.path === 'server/index.js')
        ?.buffer.toString()
    ).toBe(await readFile(join(root, 'dist/server/index.js'), 'utf8'));
    expect(output.deployment.assets.binding).toBe('ASSETS');
  });
  it('describes resource requirements without uploading values or the deployment config', async () => {
    await writeConfig({
      d1_databases: [{ binding: 'DB', database_id: 'private-id' }],
      r2_buckets: [{ binding: 'MEDIA', bucket_name: 'private-bucket' }],
      kv_namespaces: [{ binding: 'SESSION', id: 'private-kv' }],
      vars: { EMDASH_SITE_URL: 'https://private.example' },
      triggers: { crons: ['* * * * *'] },
      images: { binding: 'IMAGES' },
    });
    const output = await collectCloudflareOutput(root);
    expect(output.deployment.bindings).toEqual([
      { name: 'DB', type: 'd1' },
      { name: 'MEDIA', type: 'r2_bucket' },
      { name: 'SESSION', type: 'kv_namespace' },
      { name: 'IMAGES', type: 'images' },
      { name: 'EMDASH_SITE_URL', type: 'plain_text' },
    ]);
    expect(JSON.stringify(output)).not.toContain('private-');
    expect(JSON.stringify(output)).not.toContain('private.example');
    expect(output.deployment.crons).toEqual(['* * * * *']);
  });
  it('fails when the entrypoint is absent', async () => {
    await rm(join(root, 'dist/server/index.js'));
    await expect(collectCloudflareOutput(root)).rejects.toThrow('entrypoint');
  });
  it('fails when an imported server chunk was not emitted', async () => {
    await rm(join(root, 'dist/server/chunks/app.js'));
    await expect(collectCloudflareOutput(root)).rejects.toThrow(
      'server module is missing'
    );
  });
  it('rejects bare dependencies that the Worker cannot resolve', async () => {
    await writeFile(join(root, 'dist/server/chunks/app.js'), 'import "private-package";');
    await expect(collectCloudflareOutput(root)).rejects.toThrow('unbundled import');
  });
  it('fails on unsupported bindings instead of publishing an app missing capabilities', async () => {
    await writeConfig({ queues: { producers: [{ binding: 'JOBS', queue: 'jobs' }] } });
    await expect(collectCloudflareOutput(root)).rejects.toThrow('queues');
  });
  it('rejects duplicate binding names', async () => {
    await writeConfig({ d1_databases: [{ binding: 'ASSETS' }] });
    await expect(collectCloudflareOutput(root)).rejects.toThrow('Duplicate');
  });
  it('does not follow output symlinks into private source files', async () => {
    await writeFile(join(root, 'credential.txt'), 'private-credential');
    await symlink(join(root, 'credential.txt'), join(root, 'dist/server/secret.js'));
    await expect(collectCloudflareOutput(root)).rejects.toThrow('symlink');
  });
  it('rejects generated paths outside the project', async () => {
    await writeConfig({ assets: { binding: 'ASSETS', directory: '../../../' } });
    await expect(collectCloudflareOutput(root)).rejects.toThrow('outside');
  });
  it('rejects asset roots that contain the server or source tree', async () => {
    await writeConfig({ assets: { binding: 'ASSETS', directory: '../..' } });
    await expect(collectCloudflareOutput(root)).rejects.toThrow('separate');
  });
  it('accepts the empty binding groups emitted by the Cloudflare Vite plugin', async () => {
    await writeConfig({
      queues: { producers: [], consumers: [] },
      durable_objects: { bindings: [] },
      migrations: [],
    });
    const output = await collectCloudflareOutput(root);
    expect(output.entrypoint).toBe('server/index.js');
  });
  it('excludes env files, source maps and generated configuration from executable output', async () => {
    await writeFile(join(root, 'dist/server/.env'), 'SECRET=private-secret');
    await writeFile(join(root, 'dist/server/index.js.map'), 'private-source');
    const output = await collectCloudflareOutput(root);
    expect(
      Object.values(output.assetsMap).every((a) => !/\.env|\.map|wrangler/.test(a.path))
    ).toBe(true);
  });
});
