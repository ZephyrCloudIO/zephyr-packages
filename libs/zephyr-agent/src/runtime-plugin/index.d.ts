import { createZephyrRuntimePlugin } from './create-zephyr-runtime-plugin';

export { createZephyrRuntimePlugin };
export type { ZephyrRuntimePluginOptions } from './create-zephyr-runtime-plugin';
export type {
  BeforeRequestHookArgs,
  FederationRuntimePlugin,
  Options,
  Remote,
  RemoteWithEntry,
} from './module-federation.types';

export default createZephyrRuntimePlugin;
