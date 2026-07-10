import { describe, expect, it } from '@rstest/core';

import { parseZeDependencies, parseZeDependency } from '../ze-util-parse-ze-dependencies';

describe('parseZeDependencies', () => {
  it('should parse multiple dependencies correctly', () => {
    const zeDependencies = {
      'normal-dep': '^1.0.0',
      'tagged-dep': 'zephyr:other-app@stable',
      'semver-dep': 'zephyr:^2.0.0',
    };

    const result = parseZeDependencies(zeDependencies);

    expect(result).toEqual({
      'normal-dep': {
        version: '^1.0.0',
        registry: 'zephyr',
        app_uid: 'normal-dep',
      },
      'tagged-dep': {
        version: 'stable',
        registry: 'zephyr',
        app_uid: 'other-app',
      },
      'semver-dep': {
        version: '^2.0.0',
        registry: 'zephyr',
        app_uid: 'semver-dep',
      },
    });
  });

  it('should handle empty dependency object', () => {
    const result = parseZeDependencies({});
    expect(result).toEqual({});
  });
});

describe('parseZeDependency', () => {
  it('should parse standard semver dependency', () => {
    const result = parseZeDependency('test-dep', '^1.0.0');
    expect(result).toEqual({
      version: '^1.0.0',
      registry: 'zephyr',
      app_uid: 'test-dep',
    });
  });

  it('should parse zephyr remote with tag', () => {
    const result = parseZeDependency('local-name', 'zephyr:remote-app@beta');
    expect(result).toEqual({
      version: 'beta',
      registry: 'zephyr',
      app_uid: 'remote-app',
    });
  });

  it('should parse zephyr with semver', () => {
    const result = parseZeDependency('local-name', 'zephyr:^2.0.0');
    expect(result).toEqual({
      version: '^2.0.0',
      registry: 'zephyr',
      app_uid: 'local-name',
    });
  });

  it('should parse zephyr with tilde version', () => {
    const result = parseZeDependency('local-name', 'zephyr:~1.2.3');
    expect(result).toEqual({
      version: '~1.2.3',
      registry: 'zephyr',
      app_uid: 'local-name',
    });
  });

  it('should parse zephyr with exact version', () => {
    const result = parseZeDependency('local-name', 'zephyr:=1.2.3');
    expect(result).toEqual({
      version: '=1.2.3',
      registry: 'zephyr',
      app_uid: 'local-name',
    });
  });

  it('should parse zephyr with greater than version', () => {
    const result = parseZeDependency('local-name', 'zephyr:>1.2.3');
    expect(result).toEqual({
      version: '>1.2.3',
      registry: 'zephyr',
      app_uid: 'local-name',
    });
  });

  it('should parse zephyr with less than version', () => {
    const result = parseZeDependency('local-name', 'zephyr:<2.0.0');
    expect(result).toEqual({
      version: '<2.0.0',
      registry: 'zephyr',
      app_uid: 'local-name',
    });
  });

  it('should keep workspace:* for branch-aware resolution', () => {
    const result = parseZeDependency('local-workspace-dep', 'workspace:*');
    expect(result).toEqual({
      version: 'workspace:*',
      registry: 'zephyr',
      app_uid: 'local-workspace-dep',
    });
  });

  it('should resolve app-prefixed workspace:* to the remote app_uid and keep workspace:*', () => {
    const result = parseZeDependency('rspack_mf_remote', 'rspack_mf_remote@workspace:*');
    expect(result).toEqual({
      version: 'workspace:*',
      registry: 'zephyr',
      app_uid: 'rspack_mf_remote',
    });
  });

  it('should resolve a scoped app-prefixed workspace:* dependency', () => {
    const result = parseZeDependency('host', '@app-zephyr/host@workspace:*');
    expect(result).toEqual({
      version: 'workspace:*',
      registry: 'zephyr',
      app_uid: '@app-zephyr/host',
    });
  });

  it('should pass through an explicit workspace range as semver', () => {
    const result = parseZeDependency('local-workspace-dep', 'workspace:^1.2.3');
    expect(result).toEqual({
      version: '^1.2.3',
      registry: 'zephyr',
      app_uid: 'local-workspace-dep',
    });
  });

  it('should normalize workspace:^, workspace:~ and bare workspace: to workspace:*', () => {
    expect(parseZeDependency('dep', 'workspace:^')).toEqual({
      version: 'workspace:*',
      registry: 'zephyr',
      app_uid: 'dep',
    });
    expect(parseZeDependency('dep', 'workspace:~')).toEqual({
      version: 'workspace:*',
      registry: 'zephyr',
      app_uid: 'dep',
    });
    expect(parseZeDependency('dep', 'workspace:')).toEqual({
      version: 'workspace:*',
      registry: 'zephyr',
      app_uid: 'dep',
    });
  });

  it('should parse scoped app with tag', () => {
    const result = parseZeDependency('local-name', 'zephyr:@app-zephyr/host@latest');
    expect(result).toEqual({
      version: 'latest',
      registry: 'zephyr',
      app_uid: '@app-zephyr/host',
    });
  });

  it('should parse scoped app with multiple @ symbols in app_uid', () => {
    const result = parseZeDependency('local-name', 'zephyr:@org/@scope/app@beta');
    expect(result).toEqual({
      version: 'beta',
      registry: 'zephyr',
      app_uid: '@org/@scope/app',
    });
  });

  it('should handle different registry prefix', () => {
    const result = parseZeDependency('local-name', 'custom-registry:remote-app@stable');
    expect(result).toEqual({
      version: 'stable',
      registry: 'custom-registry',
      app_uid: 'remote-app',
    });
  });
});
