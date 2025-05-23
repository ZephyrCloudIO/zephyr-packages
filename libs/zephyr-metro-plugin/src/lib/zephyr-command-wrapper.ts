import { Platform, ZephyrEngine, ze_log } from 'zephyr-agent';
import { extractFederatedDependencyPairs } from 'zephyr-xpack-internal';

export interface ZephyrCommandWrapperConfig {
  platform: Platform;
  mode: string;
  context: string;
}

export async function zephyrCommandWrapper(config: ZephyrCommandWrapperConfig) {
  console.log('Zephyr command wrapper');

  const zephyr_engine = await ZephyrEngine.create({
    builder: 'metro',
    context: config.context,
  });
  ze_log('Configuring with Zephyr... \n config: ', config);

  zephyr_engine.env.target = config.platform;

  const dependency_pairs = extractFederatedDependencyPairs(config);

  ze_log(
    'Resolving and building towards target by zephyr_engine.env.target: ',
    zephyr_engine.env.target
  );

  const resolved_dependency_pairs =
    await zephyr_engine.resolve_remote_dependencies(dependency_pairs);

  ze_log('dependency resolution completed successfully...or at least trying to...');

  ze_log('Application uid created...');

  return;
}
