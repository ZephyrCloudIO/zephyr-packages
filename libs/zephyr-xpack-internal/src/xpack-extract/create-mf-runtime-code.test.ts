/* istanbul ignore file -- this suite evaluates generated source in a fresh Function */
import { afterEach, describe, expect, it, rs } from '@rstest/core';
import {
  createMfRuntimeCode,
  xpack_delegate_module_template,
} from './create-mf-runtime-code';

function createRuntimeCode(
  remoteEntryUrl: string,
  defaultUrl: string,
  libraryType = 'module'
): string {
  return createMfRuntimeCode(
    { builder: 'webpack' } as never,
    {
      application_uid: 'app-id',
      remote_entry_url: remoteEntryUrl,
      default_url: defaultUrl,
      name: 'remote',
      library_type: libraryType,
    } as never,
    xpack_delegate_module_template
  );
}

function evaluateRuntime(
  code: string,
  fetchImplementation: typeof fetch,
  runtimeWindow: unknown = { sessionStorage: { getItem: () => null } },
  webpackRequire: unknown = {}
): Promise<unknown> {
  return new Function(
    'fetch',
    'window',
    '__webpack_require__',
    code.replace(/^promise /, 'return ')
  )(fetchImplementation, runtimeWindow, webpackRequire) as Promise<unknown>;
}

describe('createMfRuntimeCode', () => {
  afterEach(() => {
    rs.useRealTimers();
  });

  it('falls back to the configured default URL without a preflight request', async () => {
    const remoteUrl = 'https://missing.example/remote.js';
    const defaultUrl = 'data:text/javascript,export default 42';
    const fetchMock = rs.fn(
      async (input: string | URL | Request) =>
        ({ ok: String(input) === defaultUrl }) as Response
    );
    const runtimeWindow = {
      get sessionStorage(): Storage {
        throw new Error('storage denied');
      },
    };

    const loaded = (await evaluateRuntime(
      createRuntimeCode(remoteUrl, defaultUrl),
      fetchMock as typeof fetch,
      runtimeWindow
    )) as { default: number };

    expect(loaded.default).toBe(42);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when every candidate fails to load', async () => {
    const fetchMock = rs.fn(async () => ({ ok: false }) as Response);

    await expect(
      evaluateRuntime(
        createRuntimeCode(
          'https://missing.example/remote.js',
          'https://fallback.example/remote.js'
        ),
        fetchMock as typeof fetch
      )
    ).rejects.toThrow('no loadable remote entry');
  });

  it('loads a valid module without probing its CDN', async () => {
    const remoteUrl = 'data:text/javascript,export default 11';
    const fetchMock = rs.fn(async () => ({ ok: false }) as Response);

    const loaded = (await evaluateRuntime(
      createRuntimeCode(remoteUrl, ''),
      fetchMock as typeof fetch
    )) as { default: number };

    expect(loaded.default).toBe(11);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back when a reachable primary remote fails while loading', async () => {
    const defaultUrl = 'data:text/javascript,export default 7';
    const fetchMock = rs.fn(async () => ({ ok: true }) as Response);

    const loaded = (await evaluateRuntime(
      createRuntimeCode('https://invalid.example/remote.js', defaultUrl),
      fetchMock as typeof fetch
    )) as { default: number };

    expect(loaded.default).toBe(7);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects within a bounded timeout when script loading never settles', async () => {
    rs.useFakeTimers();
    const fetchMock = rs.fn(async () => ({ ok: true }) as Response);
    const loadScript = rs.fn();
    const runtimePromise = evaluateRuntime(
      createRuntimeCode('https://hanging.example/remote.js', '', 'var'),
      fetchMock as typeof fetch,
      { sessionStorage: { getItem: () => null } },
      { l: loadScript }
    );
    const rejection = runtimePromise.then(
      () => undefined,
      (error: Error) => error
    );

    await rs.advanceTimersByTimeAsync(0);
    await rs.advanceTimersByTimeAsync(5_000);

    expect((await rejection)?.message).toContain(
      'timed out loading remote remote after 5000ms'
    );
    expect(loadScript).toHaveBeenCalledTimes(1);
  });
});
