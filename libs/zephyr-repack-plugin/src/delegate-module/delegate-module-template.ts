export function repack_delegate_module_template(): unknown {
  return new Promise((resolve, reject) => {
    const remote_entry_url = '__REMOTE_ENTRY_URL__';
    const library_type = '__LIBRARY_TYPE__';

    let edgeUrl = remote_entry_url;
    let remote_name = '__REMOTE_NAME__';

    if (edgeUrl.includes('@')) {
      [remote_name, edgeUrl] = edgeUrl.split('@') as [string, string];
    }

    const resolve_entry = [
      fetch(edgeUrl, {
        method: 'HEAD',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
        .then(() => edgeUrl)
        .catch(() => false),
    ];

    Promise.race(resolve_entry)
      .then((remoteUrl) => {
        if (typeof remoteUrl !== 'string') return;
        let _win: Record<string, unknown> = {};
        _win =
          globalThis !== undefined
            ? globalThis
            : (global as unknown as Record<string, unknown>);

        const ScriptManager = __webpack_require__.repack.shared.scriptManager;
        ScriptManager.addResolver(
          // @ts-expect-error TODO fix await
          (scriptId: string, caller?: string, referenceUrl?: string) => {
            if (scriptId === remote_name) {
              return { url: remoteUrl };
            }

            if (referenceUrl && caller === remote_name) {
              const publicPath = remoteUrl.split('/').slice(0, -1).join('/');
              const bundlePath = scriptId + referenceUrl.split(scriptId)[1];
              return { url: publicPath + '/' + bundlePath };
            }

            return;
          },
          { key: remote_name }
        );

        if (typeof _win[remote_name] !== 'undefined') {
          return resolve(_win[remote_name]);
        }

        if (
          typeof __webpack_require__ !== 'undefined' &&
          typeof __webpack_require__.l === 'function' &&
          // @ts-expect-error - library_type is inherited enum type instead of string
          library_type !== 'self'
        ) {
          // @ts-expect-error temp
          __webpack_require__.l(
            remote_entry_url,
            () => {
              resolve(_win[remote_name]);
            },
            remote_name
            // remote_name
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
          .catch((err: unknown) => {
            reject(err);
          });
      })
      .catch((err) => {
        console.error(`Zephyr: error loading remote entry ${remote_entry_url}`, err);
      });
  });
}
