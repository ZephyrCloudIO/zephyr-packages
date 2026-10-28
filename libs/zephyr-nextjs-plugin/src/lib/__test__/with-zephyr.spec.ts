import { describe, expect, it } from '@rstest/core';
import { resolveAdapterPath, withZephyr } from '../with-zephyr';

describe('withZephyr', () => {
  it('forces standalone output and registers the adapter', () => {
    const config = withZephyr({ reactStrictMode: true });

    expect(config).toEqual({
      reactStrictMode: true,
      output: 'standalone',
      adapterPath: resolveAdapterPath(),
    });
  });

  it('accepts config interfaces without an index signature, like NextConfig', () => {
    interface ConfigInterface {
      output?: 'standalone' | 'export';
      reactStrictMode?: boolean;
    }
    const nextConfig: ConfigInterface = { reactStrictMode: true };

    expect(withZephyr(nextConfig).output).toBe('standalone');
  });

  it('wraps config functions', async () => {
    const config = withZephyr((phase: string) => ({ env: { phase } }));

    expect(await config('phase-production-build')).toEqual({
      env: { phase: 'phase-production-build' },
      output: 'standalone',
      adapterPath: resolveAdapterPath(),
    });
  });

  it('points Next.js at the ESM adapter build', () => {
    // Next unwraps `default` once; a CommonJS adapter would never run.
    expect(resolveAdapterPath()).toMatch(/[\\/]adapter\.mjs$/);
  });

  it('rejects assetPrefix, other outputs, and other adapters', () => {
    expect(() => withZephyr({ assetPrefix: 'https://cdn.example.com' })).toThrow(
      /assetPrefix/
    );
    expect(() => withZephyr({ output: 'export' })).toThrow(/standalone/);
    expect(() => withZephyr({ adapterPath: '/other/adapter.js' })).toThrow(
      /single adapter/
    );
  });
});
