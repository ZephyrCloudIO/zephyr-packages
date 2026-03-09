import * as zephyrMetroPlugin from '../../index';

describe('package root exports', () => {
  it('exports zephyrCommandWrapper for CLI integrations', () => {
    expect(zephyrMetroPlugin).toHaveProperty('zephyrCommandWrapper');
    expect(typeof zephyrMetroPlugin.zephyrCommandWrapper).toBe('function');
  });
});
