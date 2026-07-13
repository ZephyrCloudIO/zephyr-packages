import { describe, expect, it, rs } from '@rstest/core';

import { onBuildStart } from './on-build-start';

describe('onBuildStart', () => {
  it('forwards the selected tap-app target into ZephyrEngine creation', async () => {
    const zephyr_defer_create = rs.fn();

    await onBuildStart({
      zephyr_defer_create,
      projectRoot: '/workspace/tap-package',
      target: 'tap-app',
    });

    expect(zephyr_defer_create).toHaveBeenCalledWith({
      builder: 'parcel',
      context: '/workspace/tap-package',
      target: 'tap-app',
    });
  });
});
