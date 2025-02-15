/** @type {() => import('@module-federation/runtime').FederationRuntimePlugin} */
const runtimePlugin = () => {
  return {
    name: 'ZephyrMFRuntimePlugin',
    beforeRegisterRemote: (config) => {
      if (!window) return config;
      const resolvedRemote = window.__ZEPHYR_GLOBAL__?.remoteMap?.[config.remote.name];
      if (!resolvedRemote) return config;

      const sessionEdgeURL = window.sessionStorage.getItem(
        resolvedRemote.application_uid
      );
      if (!sessionEdgeURL) return config;
      config.remote.entry = sessionEdgeURL;
      return config;
    },
  };
};

export default runtimePlugin;
