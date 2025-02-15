/** @type {() => import('@module-federation/runtime').FederationRuntimePlugin} */
const runtimePlugin = () => {
  return {
    name: 'ZephyrMFRuntimePlugin',
    beforeRegisterRemote: (config) => {
      console.log('------- remote before: ', JSON.stringify(config.remote, null, 2));
      if (!window) return config;
      const resolvedRemote = window.__ZEPHYR_GLOBAL__?.remoteMap?.[config.remote.name];
      if (!resolvedRemote) return config;

      const sessionEdgeURL = window.sessionStorage.getItem(
        resolvedRemote.application_uid
      );
      if (!sessionEdgeURL) return config;
      config.remote.entry = sessionEdgeURL;
      console.log('------- remote after: ', JSON.stringify(config.remote, null, 2));
      return config;
    },
  };
};

export default runtimePlugin;
