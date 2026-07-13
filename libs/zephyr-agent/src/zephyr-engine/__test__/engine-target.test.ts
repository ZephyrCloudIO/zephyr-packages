import { describe, expect, it } from '@rstest/core';
import { ZephyrEngine } from '../index';

describe('ZephyrEngine target validation', () => {
  it('rejects an unsupported public target before engine initialization', async () => {
    await expect(
      ZephyrEngine.create({
        builder: 'unknown',
        context: '/project',
        target: 'desktop' as never,
      })
    ).rejects.toThrow('ZephyrEngine.create({ target }) must be one of');
  });
});
