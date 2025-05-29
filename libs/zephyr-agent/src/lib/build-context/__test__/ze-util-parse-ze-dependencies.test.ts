import { parseZeDependencies, parseZeDependency } from '../ze-util-parse-ze-dependencies';

describe('parseZeDependencies', () => {
  it('should parse multiple dependencies correctly', () => {
    // Arrange
    const zeDependencies = {
      'normal-dep': '^1.0.0',
      'tagged-dep': 'zephyr:other-app@stable',
      'semver-dep': 'zephyr:^2.0.0',
    };

    // Act
    const result = parseZeDependencies(zeDependencies);

    // Assert
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
    // Act
    const result = parseZeDependencies({});

    // Assert
    expect(result).toEqual({});
  });
});

describe('parseZeDependency', () => {
  it('should parse standard semver dependency', () => {
    // Act
    const result = parseZeDependency('test-dep', '^1.0.0');

    // Assert
    expect(result).toEqual({
      version: '^1.0.0',
      registry: 'zephyr',
      app_uid: 'test-dep',
      target: 'web',
    });
  });

  it('should parse zephyr remote with tag', () => {
    // Act
    const result = parseZeDependency('local-name', 'zephyr:remote-app@beta');

    // Assert
    expect(result).toEqual({
      version: 'beta',
      registry: 'zephyr',
      app_uid: 'remote-app',
      target: 'web',
    });
  });

  it('should parse zephyr with semver', () => {
    // Act
    const result = parseZeDependency('local-name', 'zephyr:^2.0.0');

    // Assert
    expect(result).toEqual({
      version: '^2.0.0',
      registry: 'zephyr',
      app_uid: 'local-name',
      target: 'web',
    });
  });

  it('should parse zephyr with tilde version', () => {
    // Act
    const result = parseZeDependency('local-name', 'zephyr:~1.2.3');

    // Assert
    expect(result).toEqual({
      version: '~1.2.3',
      registry: 'zephyr',
      app_uid: 'local-name',
      target: 'web',
    });
  });

  it('should parse zephyr with exact version', () => {
    // Act
    const result = parseZeDependency('local-name', 'zephyr:=1.2.3');

    // Assert
    expect(result).toEqual({
      version: '=1.2.3',
      registry: 'zephyr',
      app_uid: 'local-name',
      target: 'web',
    });
  });

  it('should parse zephyr with greater than version', () => {
    // Act
    const result = parseZeDependency('local-name', 'zephyr:>1.2.3');

    // Assert
    expect(result).toEqual({
      version: '>1.2.3',
      registry: 'zephyr',
      app_uid: 'local-name',
      target: 'web',
    });
  });

  it('should parse zephyr with less than version', () => {
    // Act
    const result = parseZeDependency('local-name', 'zephyr:<2.0.0');

    // Assert
    expect(result).toEqual({
      version: '<2.0.0',
      registry: 'zephyr',
      app_uid: 'local-name',
      target: 'web',
    });
  });
});
