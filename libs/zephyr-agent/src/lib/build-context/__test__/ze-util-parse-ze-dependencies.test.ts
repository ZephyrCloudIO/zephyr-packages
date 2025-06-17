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
        target: 'web',
      },
      'tagged-dep': {
        version: 'stable',
        registry: 'zephyr',
        app_uid: 'other-app',
        target: 'web',
      },
      'semver-dep': {
        version: '^2.0.0',
        registry: 'zephyr',
        app_uid: 'semver-dep',
        target: 'web',
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
      target: 'web',
    });
  });

  it('should parse zephyr remote with tag', () => {
    const result = parseZeDependency('local-name', 'zephyr:remote-app@beta');
    expect(result).toEqual({
      version: 'beta',
      registry: 'zephyr',
      app_uid: 'remote-app',
      target: 'web',
    });
  });

  it('should parse zephyr with semver', () => {
    const result = parseZeDependency('local-name', 'zephyr:^2.0.0');
    expect(result).toEqual({
      version: '^2.0.0',
      registry: 'zephyr',
      app_uid: 'local-name',
      target: 'web',
    });
  });

  it('should parse zephyr with tilde version', () => {
    const result = parseZeDependency('local-name', 'zephyr:~1.2.3');
    expect(result).toEqual({
      version: '~1.2.3',
      registry: 'zephyr',
      app_uid: 'local-name',
      target: 'web',
    });
  });

  it('should parse zephyr with exact version', () => {
    const result = parseZeDependency('local-name', 'zephyr:=1.2.3');
    expect(result).toEqual({
      version: '=1.2.3',
      registry: 'zephyr',
      app_uid: 'local-name',
      target: 'web',
    });
  });

  it('should parse zephyr with greater than version', () => {
    const result = parseZeDependency('local-name', 'zephyr:>1.2.3');
    expect(result).toEqual({
      version: '>1.2.3',
      registry: 'zephyr',
      app_uid: 'local-name',
      target: 'web',
    });
  });

  it('should parse zephyr with less than version', () => {
    const result = parseZeDependency('local-name', 'zephyr:<2.0.0');
    expect(result).toEqual({
      version: '<2.0.0',
      registry: 'zephyr',
      app_uid: 'local-name',
      target: 'web',
    });
  });

  it('should handle workspace:* dependency', () => {
    const result = parseZeDependency('local-workspace-dep', 'workspace:*');
    expect(result).toEqual({
      version: 'workspace:*',
      registry: 'zephyr',
      app_uid: 'local-workspace-dep',
      target: 'web',
    });
  });

  it('should parse scoped app with tag', () => {
    const result = parseZeDependency('local-name', 'zephyr:@app-zephyr/host@latest');
    expect(result).toEqual({
      version: 'latest',
      registry: 'zephyr',
      app_uid: '@app-zephyr/host',
      target: 'web',
    });
  });

  it('should parse scoped app with multiple @ symbols in app_uid', () => {
    const result = parseZeDependency('local-name', 'zephyr:@org/@scope/app@beta');
    expect(result).toEqual({
      version: 'beta',
      registry: 'zephyr',
      app_uid: '@org/@scope/app',
      target: 'web',
    });
  });

  it('should handle different registry prefix', () => {
    const result = parseZeDependency('local-name', 'custom-registry:remote-app@stable');
    expect(result).toEqual({
      version: 'stable',
      registry: 'custom-registry',
      app_uid: 'remote-app',
      target: 'web',
    });
  });
});
