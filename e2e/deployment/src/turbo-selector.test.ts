import { describe, expect, it } from '@rstest/core';

import {
  getRepositoryRoot,
  getTurboPackageSelector,
  listTurboPackages,
} from './turbo-selector';

describe('getTurboPackageSelector', () => {
  it('selects all examples when explicitly forced', () => {
    expect(getTurboPackageSelector(true)).toEqual(['--filter=./examples/*']);
  });

  it('selects only affected packages by default', () => {
    expect(getTurboPackageSelector(false)).toEqual(['--affected']);
  });

  it('lists examples relative to the repository root', () => {
    const output = listTurboPackages(true, getRepositoryRoot(import.meta.dirname));
    const result = JSON.parse(output.toString()) as {
      packages: { items: Array<{ path: string }> };
    };

    expect(
      result.packages.items.some((pkg) =>
        pkg.path.replaceAll('\\', '/').startsWith('examples/')
      )
    ).toBe(true);
  });
});
