import { withZephyr } from '../index';

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
