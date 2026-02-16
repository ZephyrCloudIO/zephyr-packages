import { shouldSkipZephyrUpload } from './runtime-guards';

describe('shouldSkipZephyrUpload', () => {
  it('skips on postinstall lifecycle', () => {
    expect(
      shouldSkipZephyrUpload({
        argv: ['node', 'nuxi', 'build'],
        env: { npm_lifecycle_event: 'postinstall' },
      })
    ).toBe(true);
  });

  it('skips when prepare command is detected from argv', () => {
    expect(
      shouldSkipZephyrUpload({
        argv: ['node', 'nuxi', 'prepare'],
        env: {},
      })
    ).toBe(true);
  });

  it('does not skip for regular build command', () => {
    expect(
      shouldSkipZephyrUpload({
        argv: ['node', 'nuxi', 'build'],
        env: {},
      })
    ).toBe(false);
  });
});
