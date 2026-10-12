import { describe, expect, it } from '@rstest/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getZephyrCliVersion } from './cli-version';

describe('getZephyrCliVersion', () => {
  it('reports the version of the installed zephyr-cli package', () => {
    const packageJson = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8')
    ) as { name: string; version: string };

    expect(packageJson.name).toBe('zephyr-cli');
    expect(getZephyrCliVersion()).toBe(packageJson.version);
  });
});
