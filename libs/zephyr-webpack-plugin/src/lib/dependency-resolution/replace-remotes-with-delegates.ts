import { Configuration } from 'webpack';
import { replace_remote_in_mf_config } from '../../delegate-module/zephyr-delegate';
import { isModuleFederationPlugin } from '../utils/is-mf-plugin';

export interface DelegateConfig {
  org: string;
  project: string;
  application?: undefined;
}

export async function replaceRemotesWithDelegates(_config: unknown, { org, project }: DelegateConfig): Promise<void> {
  // this is WebpackOptionsNormalized type but this type is not exported
  const config = _config as Configuration;

  const depsResolutionTasks = config.plugins
    ?.filter(isModuleFederationPlugin)
    ?.map((mfConfig) => replace_remote_in_mf_config(mfConfig, { org, project }));

  if (depsResolutionTasks) {
    await Promise.all(depsResolutionTasks);
  }
}
