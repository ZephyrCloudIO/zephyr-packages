import { ZephyrEngine, ze_log } from 'zephyr-agent';

export interface ZephyrCommandWrapperConfig {
  platform: string;
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

    return;
};

