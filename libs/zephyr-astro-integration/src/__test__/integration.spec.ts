import { withZephyr } from '../index';

jest.mock('zephyr-agent', () => ({
  ZephyrEngine: {
    defer_create: jest.fn().mockReturnValue({
      zephyr_engine_defer: Promise.resolve({
        buildProperties: { output: '' },
        start_new_build: jest.fn(),
        upload_assets: jest.fn(),
        build_finished: jest.fn(),
      }),
      zephyr_defer_create: jest.fn(),
    }),
  },
  zeBuildDashData: jest.fn().mockResolvedValue({}),
  handleGlobalError: jest.fn(),
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
