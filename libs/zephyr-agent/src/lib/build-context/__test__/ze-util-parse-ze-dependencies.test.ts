import { parseZeDependencies, parseZeDependency } from '../ze-util-parse-ze-dependencies';

describe('parseZeDependencies', () => {
  it('should parse multiple dependencies correctly', () => {
    // Arrange
    const zeDependencies = {
      'normal-dep': '^1.0.0',
      'zephyr-dep': 'zephyr:my-remote-app',
      'tagged-dep': 'zephyr:other-app@stable',
      'semver-dep': 'zephyr:^2.0.0',
    };

    // Act
    const result = parseZeDependencies(zeDependencies);

    // Assert
    expect(result).toEqual({
      'normal-dep': {
        version: '^1.0.0',
        registry: 'npm',
        app_uid: 'normal-dep',
      },
      'zephyr-dep': {
        version: 'latest',
        registry: 'zephyr',
        app_uid: 'my-remote-app',
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
      registry: 'npm',
      app_uid: 'test-dep',
    });
  });

  it('should parse zephyr remote reference', () => {
    // Act
    const result = parseZeDependency('local-name', 'zephyr:remote-app');

    // Assert
    expect(result).toEqual({
      version: 'latest',
      registry: 'zephyr',
      app_uid: 'remote-app',
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
    });
  });

  it('should handle malformed zephyr reference gracefully', () => {
    // Act
    const result = parseZeDependency('broken-dep', 'zephyr:');

    // Assert
    expect(result).toEqual({
      version: 'latest', // Default to latest for empty reference
      registry: 'zephyr',
      app_uid: '', // Empty app_uid since nothing follows zephyr:
    });
  });
});
