import { defineEventHandler } from 'h3';

export default defineEventHandler(() => {
  return {
    ok: true,
    preset: 'cloudflare_module',
    source: 'nitro-preset-cloudflare-example',
  };
});
