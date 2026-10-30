import { beforeEach, describe, expect, it, rs } from '@rstest/core';

import type { ZephyrBuildTarget } from 'zephyr-edge-contract';
import type { ZeResolvedDependency } from '../resolve_remote_dependency';
import { ZephyrEngine } from '../index';

const mocks = rs.hoisted(() => ({
  resolve: rs.fn(),
  logFn: rs.fn(),
}));

rs.mock('../resolve_remote_dependency', () => ({
  resolve_remote_dependency: mocks.resolve,
}));

rs.mock('../../lib/logging/ze-log-event', () => ({
  formatLogMsg: rs.fn((message: string) => message),
  logFn: mocks.logFn,
  logger: rs.fn(),
}));

function engine(
  target: ZephyrBuildTarget = 'ios',
  dependencyUrlMode?: 'selector' | 'version'
): ZephyrEngine {
  const value = Object.create(ZephyrEngine.prototype) as ZephyrEngine;
  value.application_uid = 'shell.project.org';
  value.application_configuration = Promise.resolve({ username: 'dev' } as never);
  value.gitProperties = {
    app: { org: 'org', project: 'project' },
    git: { branch: 'main' },
  } as never;
  value.zephyrConfig = dependencyUrlMode ? { dependencyUrlMode } : {};
  value.env = { isCI: false, target, ssr: false };
  return value;
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

describe('ZephyrEngine.resolve_runtime_manifest_url', () => {
  beforeEach(() => {
    mocks.resolve.mockReset();
    mocks.logFn.mockReset();
  });

  it("resolves the app's own label alias in selector mode", async () => {
    mocks.resolve.mockResolvedValueOnce(resolved());

    const url = await engine('ios', 'version').resolve_runtime_manifest_url(
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

    const url = await engine().resolve_runtime_manifest_url('zephyr:shell_config@prod');

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
      engine().resolve_runtime_manifest_url('@production-${target}')
    ).rejects.toThrow(message);
  });

  it('warns when the API cannot confirm the matched label and platform', async () => {
    mocks.resolve.mockResolvedValueOnce(
      resolved({ entity_name: undefined, resolved_platform: undefined })
    );

    await engine().resolve_runtime_manifest_url('@production-ios');

    expect(mocks.logFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('did not report the matched label and platform')
    );
  });
});
