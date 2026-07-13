import { describe, expect, it, rs } from '@rstest/core';

rs.mock('zephyr-xpack-internal', () => ({
  logBuildSteps: rs.fn(),
  setupZeDeploy: rs.fn(),
}));

import { ZeRepackPlugin } from './ze-repack-plugin';

describe('ZeRepackPlugin', () => {
  it('rejects tap-app from untyped callers before registration', () => {
    expect(
      () =>
        new ZeRepackPlugin({
          zephyr_engine: {} as never,
          mfConfig: undefined,
          target: 'tap-app' as never,
        })
    ).toThrow('Re.Pack cannot publish tap-app artifacts.');
  });

  it('rejects a tap-app engine mutation before deployment hooks register', () => {
    const engine = {
      env: { target: 'ios' },
      buildProperties: {},
    };
    const plugin = new ZeRepackPlugin({
      zephyr_engine: engine as never,
      mfConfig: undefined,
      target: 'ios',
    });
    engine.env.target = 'tap-app';

    expect(() => plugin.apply({ outputPath: '/repo/dist' } as never)).toThrow(
      'Re.Pack cannot publish tap-app artifacts.'
    );
  });
});
