import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import * as actualAgent from 'zephyr-agent' with { rstest: 'importActual' };
import type { ZeResolvedDependency } from 'zephyr-agent';
import type { ZephyrBuildTarget } from 'zephyr-edge-contract';

const mocks = rs.hoisted(() => ({
  resolve: rs.fn(),
  logFn: rs.fn(),
}));

rs.mock('zephyr-agent', () => ({
  ...actualAgent,
  resolve_remote_dependency: mocks.resolve,
  logFn: mocks.logFn,
}));

import { resolveRuntimeManifestUrl } from './resolve-runtime-manifest';

function engine(
  target: ZephyrBuildTarget = 'ios',
  dependencyUrlMode?: 'selector' | 'version'
): Parameters<typeof resolveRuntimeManifestUrl>[0] {
  return {
    application_uid: 'shell.project.org',
    application_configuration: Promise.resolve({ username: 'dev' } as never),
    gitProperties: {
      app: { org: 'org', project: 'project' },
      git: { branch: 'main' },
    } as never,
    zephyrConfig: dependencyUrlMode ? { dependencyUrlMode } : {},
    env: { isCI: false, target, ssr: false },
  };
}

function resolved(overrides: Partial<ZeResolvedDependency> = {}): ZeResolvedDependency {
  return {
    name: 'shell.project.org',
    version: 'production-ios',
    application_uid: 'shell.project.org',
    default_url: 'https://production-ios-shell-abc.zephyr.example',
    remote_entry_url: 'https://production-ios-shell-abc.zephyr.example/shell.bundle',
    library_type: 'var',
    entity_type: 'environment',
    entity_name: 'production-ios',
    resolved_platform: 'ios',
    ...overrides,
  };
}

describe('resolveRuntimeManifestUrl', () => {
  beforeEach(() => {
    mocks.resolve.mockReset();
    mocks.logFn.mockReset();
  });

  it("resolves the app's own label alias in selector mode", async () => {
    mocks.resolve.mockResolvedValueOnce(resolved());

    const url = await resolveRuntimeManifestUrl(
      engine('ios', 'version'),
      '@production-${target}'
    );

    expect(url).toBe(
      'https://production-ios-shell-abc.zephyr.example/zephyr-manifest.json'
    );
    expect(mocks.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        application_uid: 'shell.project.org',
        version: 'production-ios',
        platform: 'ios',
        dependencyUrlMode: 'selector',
      })
    );
    expect(mocks.logFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('dependencyUrlMode "version"')
    );
  });

  it("resolves another app's label within the project", async () => {
    mocks.resolve.mockResolvedValueOnce(
      resolved({
        application_uid: 'shell-config.project.org',
        default_url: 'https://prod-config.zephyr.example/',
        entity_type: 'tag',
        entity_name: 'prod',
      })
    );

    const url = await resolveRuntimeManifestUrl(engine(), 'zephyr:shell_config@prod');

    expect(url).toBe('https://prod-config.zephyr.example/zephyr-manifest.json');
    expect(mocks.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ application_uid: 'shell-config.project.org' })
    );
  });

  it.each([
    [
      'a version',
      resolved({ entity_type: 'version', entity_name: null }),
      'resolved to a version',
    ],
    [
      'the default environment instead of the label',
      resolved({ entity_name: 'default' }),
      'resolved to environment "default"',
    ],
    [
      'a web deployment for a mobile build',
      resolved({ resolved_platform: 'web' }),
      'resolved to a web deployment',
    ],
  ])('rejects a selector that resolves to %s', async (_, response, message) => {
    mocks.resolve.mockResolvedValueOnce(response);

    await expect(
      resolveRuntimeManifestUrl(engine(), '@production-${target}')
    ).rejects.toThrow(message);
  });

  it('warns when the API cannot confirm the matched label and platform', async () => {
    mocks.resolve.mockResolvedValueOnce(
      resolved({ entity_name: undefined, resolved_platform: undefined })
    );

    await resolveRuntimeManifestUrl(engine(), '@production-ios');

    expect(mocks.logFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('did not report the matched label and platform')
    );
  });
});
