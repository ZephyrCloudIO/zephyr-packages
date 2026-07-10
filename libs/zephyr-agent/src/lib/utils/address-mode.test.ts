import { describe, expect, it } from '@rstest/core';
import { usesPathAddressing } from './address-mode';

describe('usesPathAddressing', () => {
  it('detects a path-addressed primary target', () => {
    expect(usesPathAddressing({ ADDRESS_MODE: 'path' })).toBe(true);
  });

  it('detects a path-addressed environment behind a hostname primary', () => {
    expect(
      usesPathAddressing({
        ADDRESS_MODE: 'hostname',
        ENVIRONMENTS: {
          preview: {
            addressMode: 'path',
          },
        },
      })
    ).toBe(true);
  });

  it('returns false when every target uses hostname addressing', () => {
    expect(
      usesPathAddressing({
        ADDRESS_MODE: 'hostname',
        ENVIRONMENTS: {
          preview: {
            addressMode: 'hostname',
          },
        },
      })
    ).toBe(false);
  });
});
