import { defineNuxtModule } from '@nuxt/kit';
import type { NuxtModule } from '@nuxt/schema';
import {
  assertZephyrBuildTarget,
  isZephyrDisabled,
  logZephyrDisabled,
  ZephyrEngine,
} from 'zephyr-agent';
import { shouldSkipZephyrUpload } from './runtime-guards';
import { createUploadRunner } from './ssr-upload';
import type { NuxtLike, ZephyrNuxtOptions } from './types';

const zephyrNuxtModule: NuxtModule<ZephyrNuxtOptions> =
  defineNuxtModule<ZephyrNuxtOptions>({
    meta: {
      name: 'zephyr-nuxt-module',
      configKey: 'zephyr',
    },
    defaults: {},
    setup(options, nuxt) {
      if (options.target !== undefined) {
        assertZephyrBuildTarget(options.target, 'zephyr({ target })');
      }

      const nuxtLike = nuxt as unknown as NuxtLike;
      if (nuxtLike.options.dev || shouldSkipZephyrUpload()) return;

      // Skip mode: Nuxt builds the app as it is. No engine, token, git information,
      // SSR upload or request. A build that closes without an error says it was not
      // deployed.
      if (isZephyrDisabled()) {
        let failed = false;
        nuxtLike.hook('build:error', () => {
          failed = true;
        });
        nuxtLike.hook('close', () => {
          if (!failed) logZephyrDisabled();
        });
        return;
      }

      const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
      let initialized = false;

      const initEngine = () => {
        if (initialized) return;
        initialized = true;
        zephyr_defer_create({
          builder: 'nuxt',
          context: nuxtLike.options.rootDir,
          ...(options.target === undefined ? {} : { target: options.target }),
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

export default zephyrNuxtModule;
