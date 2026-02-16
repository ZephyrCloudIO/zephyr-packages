import { defineNuxtModule } from '@nuxt/kit';
import { ZephyrEngine } from 'zephyr-agent';
import { shouldSkipZephyrUpload } from './runtime-guards';
import { createUploadRunner } from './ssr-upload';
import type { NuxtLike, ZephyrNuxtOptions } from './types';

export default defineNuxtModule<ZephyrNuxtOptions>({
  meta: {
    name: 'zephyr-nuxt-module',
    configKey: 'zephyr',
  },
  defaults: {},
  setup(options, nuxt) {
    const nuxtLike = nuxt as unknown as NuxtLike;
    if (nuxtLike.options.dev || shouldSkipZephyrUpload()) return;

    const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
    let initialized = false;

    const initEngine = () => {
      if (initialized) return;
      initialized = true;
      zephyr_defer_create({
        builder: 'nuxt',
        context: nuxtLike.options.rootDir,
      });
    };

    const runUpload = createUploadRunner({
      nuxt: nuxtLike,
      options,
      zephyrEngineDefer: zephyr_engine_defer,
      initEngine,
    });

    nuxtLike.hook('close', async () => {
      await runUpload();
    });
  },
});
