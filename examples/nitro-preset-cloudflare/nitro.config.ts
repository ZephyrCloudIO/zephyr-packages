import { defineNitroConfig } from 'nitro/config';

export default defineNitroConfig({
  compatibilityDate: '2026-02-16',
  preset: './preset',
  handlers: [
    {
      route: '/',
      handler: './server/routes/index.ts',
    },
    {
      route: '/health',
      handler: './server/routes/health.ts',
    },
    {
      route: '/time',
      handler: './server/routes/time.ts',
    },
    {
      route: '/echo',
      handler: './server/routes/echo.ts',
    },
    {
      route: '/demo/routes',
      handler: './server/routes/demo-routes.ts',
    },
  ],
});
