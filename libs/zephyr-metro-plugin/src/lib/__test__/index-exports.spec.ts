import { rs } from '@rstest/core';
rs.mock('../with-zephyr', () => ({
  withZephyr: rs.fn(),
  withZephyrMetro: rs.fn(),
}));

rs.mock('../zephyr-metro-command-wrapper', () => ({
  zephyrCommandWrapper: rs.fn(),
}));

rs.mock('../zephyr-metro-rnef-plugin', () => ({
  zephyrMetroRNEFPlugin: rs.fn(),
}));

import * as zephyrMetroPlugin from '../../index';

describe('package root exports', () => {
  it('exports zephyrCommandWrapper for CLI integrations', () => {
    expect(zephyrMetroPlugin).toHaveProperty('zephyrCommandWrapper');
    expect(typeof zephyrMetroPlugin.zephyrCommandWrapper).toBe('function');
  });

  it('exports zephyrMetroRNEFPlugin for RNEF integrations', () => {
    expect(zephyrMetroPlugin).toHaveProperty('zephyrMetroRNEFPlugin');
    expect(typeof zephyrMetroPlugin.zephyrMetroRNEFPlugin).toBe('function');
  });
});
