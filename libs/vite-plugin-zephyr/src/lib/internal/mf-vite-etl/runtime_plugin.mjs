/**
 * Zephyr Runtime Plugin for Module Federation This file MUST be in ES Module
 * format (.mjs) for Vite/Rollup compatibility
 *
 * The **REMOTE_MAP** placeholder will be replaced during build time with actual
 * resolved remote dependencies by the inject_resolved_remotes function.
 *
 * IMPORTANT: Module Federation expects runtime plugins to be functions that
 * return the plugin object, not the object itself. That's why we export a
 * function here, not a plain object.
 */

const REMOTE_MAP_TEMPLATE = '"__REMOTE_MAP__"';

export default function () {
  return {
    name: 'zephyr-runtime-remote-resolver',
    beforeInit: (args) => {
      const resolvedRemoteMap = JSON.parse(REMOTE_MAP_TEMPLATE);
      const _windows = typeof window !== 'undefined' ? window : globalThis;

      args.userOptions.remotes.forEach((remote) => {
        const resolvedRemote = resolvedRemoteMap[remote.name];
        if (!resolvedRemote) {
          return;
        }

        const sessionEdgeURL = _windows.sessionStorage.getItem(
          resolvedRemote.application_uid
        );

        const urlOverwrite = sessionEdgeURL ?? resolvedRemote.remote_entry_url;

        remote.entry = urlOverwrite;
      });

      return args;
    },
  };
}
