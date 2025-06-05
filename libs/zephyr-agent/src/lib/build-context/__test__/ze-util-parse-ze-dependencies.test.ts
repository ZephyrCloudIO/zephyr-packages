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

  it('should parse complex real-world dependency scenarios', () => {
    // Arrange
    const zeDependencies = {
      '@scoped/host': 'zephyr:@company/host-app@latest',
      'workspace-dep': 'workspace:*',
      'npm-package': 'npm:lodash@^4.17.21',
      'standard-semver': '^1.0.0',
      'exact-version': '1.2.3',
      'tilde-version': '~2.1.0',
      'complex-workspace': 'zephyr:@namespace/my-app@workspace:*',
    };

    // Act
    const result = parseZeDependencies(zeDependencies);

    // Assert
    expect(result).toEqual({
      '@scoped/host': {
        version: 'latest',
        registry: 'zephyr',
        app_uid: '@company/host-app',
      },
      'workspace-dep': {
        version: '*',
        registry: 'workspace',
        app_uid: 'workspace-dep',
      },
      'npm-package': {
        version: '^4.17.21',
        registry: 'npm',
        app_uid: 'lodash',
      },
      'standard-semver': {
        version: '^1.0.0',
        registry: 'zephyr',
        app_uid: 'standard-semver',
      },
      'exact-version': {
        version: '1.2.3',
        registry: 'zephyr',
        app_uid: 'exact-version',
      },
      'tilde-version': {
        version: '~2.1.0',
        registry: 'zephyr',
        app_uid: 'tilde-version',
      },
      'complex-workspace': {
        version: 'workspace:*',
        registry: 'zephyr',
        app_uid: '@namespace/my-app',
      },
    });
  });

  it('should handle edge cases in dependency object', () => {
    // Arrange
    const zeDependencies = {
      'empty-value': '',
      'only-colon': ':',
      'only-at': '@',
      'multiple-colons': 'registry:some:complex:reference@tag',
    };

    // Act
    const result = parseZeDependencies(zeDependencies);

    // Assert
    expect(result).toEqual({
      'empty-value': {
        version: '',
        registry: 'zephyr',
        app_uid: 'empty-value',
      },
      'only-colon': {
        version: '',
        registry: '',
        app_uid: 'only-colon',
      },
      'only-at': {
        version: '',
        registry: 'zephyr',
        app_uid: '',
      },
      'multiple-colons': {
        version: 'tag',
        registry: 'registry',
        app_uid: 'some:complex:reference',
      },
    });
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

  it('should parse scoped app names with tag', () => {
    // Act
    const result = parseZeDependency('local-name', 'zephyr:@scoped/app-name@latest');

    // Assert
    expect(result).toEqual({
      version: 'latest',
      registry: 'zephyr',
      app_uid: '@scoped/app-name',
    });
  });

  it('should parse complex scoped app names with multiple @ symbols', () => {
    // Act
    const result = parseZeDependency(
      'local-name',
      'zephyr:@company/team-app@workspace:*'
    );

    // Assert
    expect(result).toEqual({
      version: 'workspace:*',
      registry: 'zephyr',
      app_uid: '@company/team-app',
    });
  });

  it('should parse workspace protocol dependency', () => {
    // Act
    const result = parseZeDependency('local-name', 'workspace:*');

    // Assert
    expect(result).toEqual({
      version: '*',
      registry: 'workspace',
      app_uid: 'local-name',
    });
  });

  it('should parse npm registry dependency', () => {
    // Act
    const result = parseZeDependency('local-name', 'npm:react@^18.0.0');

    // Assert
    expect(result).toEqual({
      version: '^18.0.0',
      registry: 'npm',
      app_uid: 'react',
    });
  });

  it('should handle custom registry without version tag', () => {
    // Act
    const result = parseZeDependency('local-name', 'custom:^1.0.0');

    // Assert
    expect(result).toEqual({
      version: '^1.0.0',
      registry: 'custom',
      app_uid: 'local-name',
    });
  });

  it('should handle dependency with no registry prefix', () => {
    // Act
    const result = parseZeDependency('react', '^18.0.0');

    // Assert
    expect(result).toEqual({
      version: '^18.0.0',
      registry: 'zephyr',
      app_uid: 'react',
    });
  });

  it('should handle malformed complex reference with colon and at', () => {
    // Act
    const result = parseZeDependency(
      'local-name',
      'zephyr:@namespace/my-app@workspace:*'
    );

    // Assert
    expect(result).toEqual({
      version: 'workspace:*',
      registry: 'zephyr',
      app_uid: '@namespace/my-app',
    });
  });

  it('should handle edge case with multiple colons', () => {
    // Act
    const result = parseZeDependency('local-name', 'registry:some:complex:reference@tag');

    // Assert
    expect(result).toEqual({
      version: 'tag',
      registry: 'registry',
      app_uid: 'some:complex:reference',
    });
  });

  it('should handle empty version string', () => {
    // Act
    const result = parseZeDependency('local-name', '');

    // Assert
    expect(result).toEqual({
      version: '',
      registry: 'zephyr',
      app_uid: 'local-name',
    });
  });

  it('should handle version with only registry prefix', () => {
    // Act
    const result = parseZeDependency('local-name', 'zephyr:');

    // Assert
    expect(result).toEqual({
      version: '',
      registry: 'zephyr',
      app_uid: 'local-name',
    });
  });

  it('should handle version with only @ symbol', () => {
    // Act
    const result = parseZeDependency('local-name', '@');

    // Assert
    expect(result).toEqual({
      version: '',
      registry: 'zephyr',
      app_uid: '',
    });
  });
});
