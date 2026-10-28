import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { d1, r2 } from '@emdash-cms/cloudflare';
import { defineConfig } from 'astro/config';
import emdash from 'emdash/astro';
import { withZephyr } from 'zephyr-astro-integration';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  vite: {
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            // Keep dependent Kysely classes together to preserve initialization order.
            groups: [{ name: 'kysely', test: /[/\\]kysely[/\\]/ }],
          },
        },
      },
    },
  },
  integrations: [
    react(),
    emdash({
      database: d1({ binding: 'DB' }),
      storage: r2({ binding: 'MEDIA' }),
      migrations: { runtime: 'check', dev: 'auto' },
    }),
    withZephyr(),
  ],
});
