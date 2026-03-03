import type { ResolvedConfig } from 'vite';
import { extractEntrypoint, resolveUploadEntrypoint } from '../extract-entrypoint';

jest.mock('zephyr-agent', () => ({
  ze_log: {
    init: jest.fn(),
  },
}));

function createConfig(input?: unknown): ResolvedConfig {
  return {
    build: {
      rollupOptions: {
        input,
      },
    },
  } as ResolvedConfig;
}

describe('extractEntrypoint', () => {
  it('extracts string input and normalizes relative prefixes', () => {
    const config = createConfig('./dist/index.html');

    expect(extractEntrypoint(config)).toBe('index.html');
  });

  it('falls back to Vite default when no input is configured', () => {
    const config = createConfig(undefined);

    expect(extractEntrypoint(config)).toBe('index.html');
  });
});

describe('resolveUploadEntrypoint', () => {
  it('returns undefined for Module Federation builds', () => {
    const config = createConfig({
      host: 'index.html',
      remote: 'remoteEntry.js',
    });

    expect(
      resolveUploadEntrypoint(config, { hasModuleFederation: true })
    ).toBeUndefined();
  });

  it('uses extracted entrypoint for non-Module Federation builds', () => {
    const config = createConfig('/dist/admin.html');

    expect(resolveUploadEntrypoint(config, { hasModuleFederation: false })).toBe(
      'admin.html'
    );
  });
});
