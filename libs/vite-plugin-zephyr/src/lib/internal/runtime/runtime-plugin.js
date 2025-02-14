import runtimeInfo from 'virtual:zephyr-runtime-info';

/** @type {() => import('@module-federation/runtime').FederationRuntimePlugin} */
const runtimePlugin = () => {
  return {
    name: 'ZephyrMFRuntimePlugin',
    beforeRegisterRemote: (config) => {
      console.log('------------ config: ', config);
      return config;
    },
  };
};

export default runtimePlugin;
