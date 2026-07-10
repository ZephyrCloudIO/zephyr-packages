import type { ZephyrEngine } from 'zephyr-agent';
import { type ZeResolvedDependency } from 'zephyr-agent';

declare const __webpack_require__: {
  l: (url: string, fn: (event?: unknown) => void, name: string, name2: string) => void;
};

const replaceRuntimeValue = (source: string, token: string, value: string): string =>
  source
    .split(`'${token}'`)
    .join(JSON.stringify(value))
    .split(`"${token}"`)
    .join(JSON.stringify(value));

export function createMfRuntimeCode(
  zephyr_engine: ZephyrEngine,
  deps: ZeResolvedDependency,
  delegate_module_template: () => unknown | undefined
): string {
  // prepare delegate function string template
  const fnReplace = delegate_module_template.toString();
  const strStart = new RegExp(/^function[\W\S]+return new Promise/);
  const strNewStart = `promise new Promise`;
  const strEnd = new RegExp(/;[^)}]+}$/);
  const promiseNewPromise = fnReplace.replace(strStart, strNewStart).replace(strEnd, '');

  const { application_uid, remote_entry_url, default_url, name, library_type } = deps;

  // If the builder is `repack` only return the remote url without any changes
  if (zephyr_engine.builder === 'repack') {
    return remote_entry_url;
  }

  return [
    ['__APPLICATION_UID__', application_uid],
    ['__REMOTE_ENTRY_URL__', remote_entry_url],
    ['__REMOTE_NAME__', name],
    ['__DEFAULT_URL__', default_url],
    ['__LIBRARY_TYPE__', library_type],
  ].reduce(
    (source, [token, value]) => replaceRuntimeValue(source, token, value),
    promiseNewPromise
  );
}

// This function is serialized into browser runtime source. Coverage counters would be
// serialized too, but their generated closure is unavailable in the deployed runtime.
/* istanbul ignore next */
/* eslint-disable no-restricted-syntax -- generated browser runtime cannot import ZephyrError */
export function xpack_delegate_module_template(): unknown {
  return new Promise((resolve, reject) => {
    const _windows = typeof window !== 'undefined' ? window : globalThis;
    const runtime_timeout_ms = 15_000;
    const candidate_timeout_ms = 5_000;
    let settled = false;

    const timeout = setTimeout(() => {
      settleReject(
        new Error(`Zephyr: timed out loading remote entry after ${runtime_timeout_ms}ms`)
      );
    }, runtime_timeout_ms);

    function settleResolve(value: unknown): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    }

    function settleReject(error: unknown): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    }

    let sessionEdgeURL: string | null = null;
    try {
      sessionEdgeURL = _windows.sessionStorage?.getItem('__APPLICATION_UID__') ?? null;
    } catch {
      // sessionStorage can throw in sandboxed or privacy-restricted runtimes.
    }

    const remote_entry_url = '__REMOTE_ENTRY_URL__';
    const default_url = '__DEFAULT_URL__';
    const library_type = '__LIBRARY_TYPE__';
    const configured_remote_name = '__REMOTE_NAME__';
    const _win = _windows as unknown as Record<string, unknown>;

    function parseRemote(candidate: string): { name: string; url: string } {
      const separator = candidate.indexOf('@');
      const possibleUrl = candidate.slice(separator + 1);
      if (
        separator > 0 &&
        (/^(?:https?:)?\/\//.test(possibleUrl) || possibleUrl.startsWith('/'))
      ) {
        return {
          name: candidate.slice(0, separator),
          url: possibleUrl,
        };
      }
      return { name: configured_remote_name, url: candidate };
    }

    const candidates = [sessionEdgeURL, remote_entry_url, default_url]
      .filter((candidate): candidate is string => Boolean(candidate))
      .map(parseRemote)
      .filter(
        (candidate, index, entries) =>
          entries.findIndex(
            (entry) => entry.name === candidate.name && entry.url === candidate.url
          ) === index
      );

    async function withLoadTimeout<T>(
      promise: Promise<T>,
      remoteName: string
    ): Promise<T> {
      let loadTimeout: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<T>((_resolve, rejectLoad) => {
        loadTimeout = setTimeout(
          () =>
            rejectLoad(
              new Error(
                `Zephyr: timed out loading remote ${remoteName} after ${candidate_timeout_ms}ms`
              )
            ),
          candidate_timeout_ms
        );
      });

      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        if (loadTimeout) clearTimeout(loadTimeout);
      }
    }

    async function loadRemote(): Promise<unknown> {
      let lastError: unknown;

      for (const candidate of candidates) {
        if (typeof _win[candidate.name] !== 'undefined') {
          return _win[candidate.name];
        }

        try {
          if (
            typeof __webpack_require__ !== 'undefined' &&
            typeof __webpack_require__.l === 'function' &&
            // @ts-expect-error - library_type is inherited enum type instead of string
            library_type !== 'module'
          ) {
            const loadedContainer = new Promise((resolveLoaded, rejectLoaded) => {
              __webpack_require__.l(
                candidate.url,
                () => {
                  const container = _win[candidate.name];
                  if (typeof container === 'undefined') {
                    rejectLoaded(
                      new Error(
                        `Zephyr: remote ${candidate.name} loaded without exposing a container`
                      )
                    );
                    return;
                  }
                  resolveLoaded(container);
                },
                candidate.name,
                candidate.name
              );
            });
            return await withLoadTimeout(loadedContainer, candidate.name);
          }

          const imported = await withLoadTimeout(
            new Function('url', 'return import(url)')(candidate.url),
            candidate.name
          );
          return typeof _win[candidate.name] !== 'undefined'
            ? _win[candidate.name]
            : imported;
        } catch (error) {
          lastError = error;
        }
      }

      const message = `Zephyr: no loadable remote entry for ${configured_remote_name} (${remote_entry_url})`;
      throw new Error(
        lastError instanceof Error ? `${message}: ${lastError.message}` : message
      );
    }

    void loadRemote().then(settleResolve, settleReject);
  });
}
/* eslint-enable no-restricted-syntax */
