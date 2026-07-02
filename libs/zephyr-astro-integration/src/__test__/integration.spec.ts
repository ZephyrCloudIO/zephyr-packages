import { rs } from '@rstest/core';
import { withZephyr } from '../index';

rs.mock('zephyr-agent', () => ({
  ZephyrEngine: {
    defer_create: rs.fn().mockReturnValue({
      zephyr_engine_defer: Promise.resolve({
        buildProperties: { output: '' },
        start_new_build: rs.fn(),
        upload_assets: rs.fn(),
        build_finished: rs.fn(),
      }),
      zephyr_defer_create: rs.fn(),
    }),
  },
  zeBuildDashData: rs.fn().mockResolvedValue({}),
  handleGlobalError: rs.fn(),
}));

describe('Integration Export', () => {
  it('should export withZephyr function', () => {
    expect(typeof withZephyr).toBe('function');
  });

  it('should create a valid Astro integration', () => {
    const integration = withZephyr();

    expect(integration).toMatchObject({
      name: 'with-zephyr',
      hooks: expect.objectContaining({
        'astro:config:done': expect.any(Function),
        'astro:build:done': expect.any(Function),
      }),
    });
  });
});
