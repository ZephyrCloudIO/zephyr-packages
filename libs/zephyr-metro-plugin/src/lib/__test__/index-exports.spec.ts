jest.mock('../with-zephyr', () => ({
  withZephyr: jest.fn(),
  withZephyrMetro: jest.fn(),
}));

jest.mock('../zephyr-metro-command-wrapper', () => ({
  zephyrCommandWrapper: jest.fn(),
}));

jest.mock('../zephyr-metro-rnef-plugin', () => ({
  zephyrMetroRNEFPlugin: jest.fn(),
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
