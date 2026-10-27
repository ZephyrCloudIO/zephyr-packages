import { afterEach, describe, expect, it } from '@rstest/core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractFederatedDependencyPairs } from './extract-federated-dependency-pairs';

describe('extractFederatedDependencyPairs', () => {
  let context: string | undefined;

  afterEach(() => {
    if (context) rmSync(context, { recursive: true, force: true });
    context = undefined;
  });

  function configWith(zephyrDependencies: Record<string, string>, remotes: object) {
    context = mkdtempSync(join(tmpdir(), 'ze-dep-pairs-'));
    writeFileSync(
      join(context, 'package.json'),
      JSON.stringify({ 'zephyr:dependencies': zephyrDependencies })
    );
    return {
      context,
      plugins: [{ name: 'ModuleFederationPlugin', _options: { name: 'host', remotes } }],
    };
  }

  it('lists a remote once when it is declared in both zephyr:dependencies and MF remotes', () => {
    const pairs = extractFederatedDependencyPairs(
      configWith(
        {
          '@mfe/user-profile': 'user-profile@workspace:*',
          '@mfe/package-only': 'package-only@workspace:*',
        },
        { '@mfe/user-profile': 'user_profile@http://localhost:3007/remoteEntry.js' }
      )
    );

    // The MF remote declaration is kept so remote rewriting can still match it;
    // the zephyr:dependencies version is applied later during resolution.
    expect(pairs).toEqual([
      { name: '@mfe/package-only', version: 'package-only@workspace:*' },
      {
        name: '@mfe/user-profile',
        version: 'user_profile@http://localhost:3007/remoteEntry.js',
      },
    ]);
  });
});
