import type { ZephyrEngine } from 'zephyr-agent';
import { type ZeResolvedDependency } from 'zephyr-agent';

declare const __webpack_require__: {
  l: (url: string, fn: () => void, name: string, name2: string) => void;
};

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

  return promiseNewPromise
    .replace('__APPLICATION_UID__', application_uid)
    .replace('__REMOTE_ENTRY_URL__', remote_entry_url)
    .replace('__REMOTE_NAME__', name)
    .replace('__DEFAULT_URL__', default_url)
    .replace('__LIBRARY_TYPE__', library_type);
}

export function xpack_delegate_module_template(): unknown {
  return new Promise((resolve, reject) => {
    const _windows = typeof window !== 'undefined' ? window : globalThis;
    const sessionEdgeURL = _windows.sessionStorage.getItem('__APPLICATION_UID__');

    const remote_entry_url = '__REMOTE_ENTRY_URL__';
    const library_type = '__LIBRARY_TYPE__';
    let edgeUrl = sessionEdgeURL ?? remote_entry_url;
    let remote_name = '__REMOTE_NAME__';

    if (edgeUrl.indexOf('@') !== -1) {
      [remote_name, edgeUrl] = edgeUrl.split('@') as [string, string];
    }

    const resolve_entry = [
      fetch(edgeUrl, { method: 'HEAD' })
        .then(() => edgeUrl)
        .catch(() => false),
    ];

    Promise.race(resolve_entry)
      .then((remoteUrl) => {
        if (typeof remoteUrl !== 'string') return;
        const _win = _windows as unknown as Record<string, unknown>;

        if (typeof _win[remote_name] !== 'undefined') {
          return resolve(_win[remote_name]);
        }

        if (
          typeof __webpack_require__ !== 'undefined' &&
          typeof __webpack_require__.l === 'function' &&
          // @ts-expect-error - library_type is inherited enum type instead of string
          library_type !== 'module'
        ) {
          __webpack_require__.l(
            remoteUrl,
            () => {
              resolve(_win[remote_name]);
            },
            remote_name,
            remote_name
          );
          return;
        }

        return new Function(`return import("${remoteUrl}")`)()
          .then((mod: unknown) => {
            if (typeof _win[remote_name] !== 'undefined') {
              return resolve(_win[remote_name]);
            }

            return resolve(mod);
          })
          .catch((err: unknown) => reject(err));
      })
      .catch((err) => {
        console.error(`Zephyr: error loading remote entry ${remote_entry_url}`, err);
      });
  });
}
