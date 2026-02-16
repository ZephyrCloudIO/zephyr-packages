import { createZephyrNitroPreset } from 'zephyr-nitro-preset';

export default createZephyrNitroPreset({
  loggerTag: 'zephyr-cloudflare-preset',
  metadataFile: '.zephyr/cloudflare-build.json',
});
