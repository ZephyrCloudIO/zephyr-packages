import { withZephyr, withZephyrTanstackStart } from './vite-plugin-tanstack-start-zephyr';

describe('vite-plugin-tanstack-start-zephyr exports', () => {
  it('keeps the deprecated alias wired to withZephyr', () => {
    expect(withZephyrTanstackStart).toBe(withZephyr);
  });
});
