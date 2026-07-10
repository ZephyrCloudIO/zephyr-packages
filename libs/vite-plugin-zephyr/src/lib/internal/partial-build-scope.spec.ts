import { describe, expect, it } from '@rstest/core';
import { resolveVitePartialBuildScope } from './partial-build-scope';

describe('Vite partial build scope', () => {
  it('uses an explicit invocation across producer and finalizer processes', () => {
    expect(
      resolveVitePartialBuildScope({ invocationId: ' shared-build ', generation: 4 }, {})
    ).toEqual({ invocationId: 'shared-build', generation: 4 });
  });

  it('supports the explicit cross-process environment contract', () => {
    expect(
      resolveVitePartialBuildScope(undefined, {
        ZE_BUILD_INVOCATION_ID: 'workflow-build',
      })
    ).toEqual({ invocationId: 'workflow-build', generation: 0 });
  });

  it('derives a scope from supported CI metadata for explicit partial builds', () => {
    expect(
      resolveVitePartialBuildScope(
        {},
        {
          GITHUB_RUN_ID: '12345',
          GITHUB_RUN_ATTEMPT: '2',
          GITHUB_JOB: 'build',
        }
      )
    ).toEqual({ invocationId: '12345:2:build', generation: 0 });
  });

  it('does not fall back to an application-global bucket', () => {
    expect(resolveVitePartialBuildScope(undefined, {})).toBeUndefined();
  });

  it('rejects invalid generations', () => {
    expect(() =>
      resolveVitePartialBuildScope({ invocationId: 'build', generation: -1 }, {})
    ).toThrow('non-negative safe integer');
  });
});
