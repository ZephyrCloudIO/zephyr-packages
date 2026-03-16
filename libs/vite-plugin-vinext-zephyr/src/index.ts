import { withZephyrVinext } from './lib/vite-plugin-vinext-zephyr';

export {
  withZephyrVinext,
  withZephyrVinext as withZephyr,
  type VinextZephyrOptions,
} from './lib/vite-plugin-vinext-zephyr';
export type { ZephyrBuildHooks, DeploymentInfo } from 'zephyr-agent';

export default withZephyrVinext;
