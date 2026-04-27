import { rs } from '@rstest/core';
import {
  withZephyr,
  withZephyrTanstackStart,
} from './vite-plugin-tanstack-start-zephyr';

rs.mock('zephyr-agent', () => ({
  ZephyrEngine: {
    defer_create: () => ({
      zephyr_engine_defer: Promise.resolve({
        upload_assets: rs.fn(),
        build_finished: rs.fn(),
      }),
      zephyr_defer_create: rs.fn(),
    }),
  },
  zeBuildDashData: rs.fn(),
  buildAssetsMap: rs.fn(),
  ZeErrors: {
    ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD',
  },
  ZephyrError: class ZephyrError extends Error {},
  ze_log: {
    init: rs.fn(),
    upload: rs.fn(),
  },
  handleGlobalError: rs.fn(),
}));

describe('vite-plugin-tanstack-start-zephyr exports', () => {
  it('keeps the deprecated alias wired to withZephyr', () => {
    expect(withZephyrTanstackStart).toBe(withZephyr);
  });
});
