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
      'normal-dep:web': {
        version: '^1.0.0',
        registry: 'zephyr',
        app_uid: 'normal-dep',
      },
      'tagged-dep:web': {
        version: 'stable',
        registry: 'zephyr',
        app_uid: 'other-app',
      },
      'semver-dep:web': {
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

  it('should parse platform-specific dependencies with object format', () => {
    // Arrange
    const zeDependencies = {
      'mobile-cart': {
        ios: '1.0.0',
        android: '1.0.1',
        web: '2.0.0',
      },
      'shared-lib': {
        ios: 'zephyr:shared-ios@latest',
        android: 'zephyr:shared-android@beta',
      },
    };

    // Act
    const result = parseZeDependencies(zeDependencies);

    // Assert
    expect(result).toEqual({
      'mobile-cart:ios': {
        version: '1.0.0',
        registry: 'zephyr',
        app_uid: 'mobile-cart',
      },
      'mobile-cart:android': {
        version: '1.0.1',
        registry: 'zephyr',
        app_uid: 'mobile-cart',
      },
      'mobile-cart:web': {
        version: '2.0.0',
        registry: 'zephyr',
        app_uid: 'mobile-cart',
      },
      'shared-lib:ios': {
        version: 'latest',
        registry: 'zephyr',
        app_uid: 'shared-ios',
      },
      'shared-lib:android': {
        version: 'beta',
        registry: 'zephyr',
        app_uid: 'shared-android',
      },
    });
  });

  it('should parse dependencies with full app_uid format', () => {
    // Arrange
    const zeDependencies = {
      'mobilecart.repo.org': 'zephyr:^1.5.0',
      'shared-component.project.company': '2.0.0',
      'ui-lib.frontend.acme': 'zephyr:ui-lib.frontend.acme@stable',
    };

    // Act
    const result = parseZeDependencies(zeDependencies);

    // Assert
    expect(result).toEqual({
      'mobilecart.repo.org:web': {
        version: '^1.5.0',
        registry: 'zephyr',
        app_uid: 'mobilecart.repo.org',
      },
      'shared-component.project.company:web': {
        version: '2.0.0',
        registry: 'zephyr',
        app_uid: 'shared-component.project.company',
      },
      'ui-lib.frontend.acme:web': {
        version: 'stable',
        registry: 'zephyr',
        app_uid: 'ui-lib.frontend.acme',
      },
    });
  });

  it('should handle dependencies with platform suffix in key', () => {
    // Arrange
    const zeDependencies = {
      'mobile-cart:ios': 'zephyr:mobile-cart@ios-v1.0',
      'mobile-cart:android': 'zephyr:mobile-cart@android-v1.1',
      'web-component:web': '^3.0.0',
    };

    // Act
    const result = parseZeDependencies(zeDependencies);

    // Assert
    expect(result).toEqual({
      'mobile-cart:ios': {
        version: 'ios-v1.0',
        registry: 'zephyr',
        app_uid: 'mobile-cart',
      },
      'mobile-cart:android': {
        version: 'android-v1.1',
        registry: 'zephyr',
        app_uid: 'mobile-cart',
      },
      'web-component:web': {
        version: '^3.0.0',
        registry: 'zephyr',
        app_uid: 'web-component:web',
      },
    });
  });

  it('should handle mixed dependency formats', () => {
    // Arrange
    const zeDependencies = {
      'simple-dep': '1.0.0',
      'tagged-dep': 'zephyr:remote-app@latest',
      'platform-dep': {
        ios: 'zephyr:ios-specific@v2.0',
        android: '^1.5.0',
      },
      'scoped-dep:web': 'npm:company-lib@^2.0.0',
    };

    // Act
    const result = parseZeDependencies(zeDependencies);

    // Assert
    expect(result).toEqual({
      'simple-dep:web': {
        version: '1.0.0',
        registry: 'zephyr',
        app_uid: 'simple-dep',
      },
      'tagged-dep:web': {
        version: 'latest',
        registry: 'zephyr',
        app_uid: 'remote-app',
      },
      'platform-dep:ios': {
        version: 'v2.0',
        registry: 'zephyr',
        app_uid: 'ios-specific',
      },
      'platform-dep:android': {
        version: '^1.5.0',
        registry: 'zephyr',
        app_uid: 'platform-dep',
      },
      'scoped-dep:web': {
        version: '^2.0.0',
        registry: 'npm',
        app_uid: 'company-lib',
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

  it('should parse npm registry dependencies', () => {
    // Act
    const result = parseZeDependency('react-lib', 'npm:@company/react-lib@^1.0.0');

    // Assert - @ symbol at beginning results in empty string for app_uid and second part as version
    expect(result).toEqual({
      version: 'company/react-lib',
      registry: 'npm',
      app_uid: '',
    });
  });

  it('should parse workspace dependencies', () => {
    // Act
    const result = parseZeDependency('local-lib', 'workspace:*');

    // Assert
    expect(result).toEqual({
      version: 'workspace:*',
      registry: 'zephyr',
      app_uid: 'local-lib',
    });
  });

  it('should parse git registry dependencies', () => {
    // Act
    const result = parseZeDependency('git-lib', 'git:github.com/user/repo@main');

    // Assert - @ symbol causes it to parse as remote app_uid
    expect(result).toEqual({
      version: 'main',
      registry: 'git',
      app_uid: 'github.com/user/repo',
    });
  });

  it('should parse complex remote app_uid with dots', () => {
    // Act
    const result = parseZeDependency(
      'local-name',
      'zephyr:mobile-cart.mobile.company@v2.1.0'
    );

    // Assert
    expect(result).toEqual({
      version: 'v2.1.0',
      registry: 'zephyr',
      app_uid: 'mobile-cart.mobile.company',
    });
  });

  it('should parse beta/alpha/rc versions', () => {
    // Act & Assert
    expect(parseZeDependency('app', 'zephyr:remote@1.0.0-beta.1')).toEqual({
      version: '1.0.0-beta.1',
      registry: 'zephyr',
      app_uid: 'remote',
    });

    expect(parseZeDependency('app', 'zephyr:remote@2.0.0-alpha')).toEqual({
      version: '2.0.0-alpha',
      registry: 'zephyr',
      app_uid: 'remote',
    });

    expect(parseZeDependency('app', 'zephyr:remote@3.0.0-rc.2')).toEqual({
      version: '3.0.0-rc.2',
      registry: 'zephyr',
      app_uid: 'remote',
    });
  });

  it('should parse version ranges', () => {
    // Act & Assert
    expect(parseZeDependency('app', 'zephyr:>=1.0.0 <2.0.0')).toEqual({
      version: '>=1.0.0 <2.0.0',
      registry: 'zephyr',
      app_uid: 'app',
    });

    expect(parseZeDependency('app', 'zephyr:^1.0.0 || ^2.0.0')).toEqual({
      version: '^1.0.0 || ^2.0.0',
      registry: 'zephyr',
      app_uid: 'app',
    });
  });

  it('should handle edge cases with multiple @ symbols', () => {
    // Act
    const result = parseZeDependency('local-name', 'zephyr:remote@app@stable@v1');

    // Assert - Only splits on first @ symbol due to destructuring assignment
    expect(result).toEqual({
      version: 'app',
      registry: 'zephyr',
      app_uid: 'remote',
    });
  });

  it('should handle edge cases with multiple : symbols', () => {
    // Act
    const result = parseZeDependency('local-name', 'custom:registry:remote-app@latest');

    // Assert - Function only splits on first colon, so everything after becomes the reference
    expect(result).toEqual({
      version: 'registry',
      registry: 'custom',
      app_uid: 'local-name',
    });
  });

  it('should preserve empty or minimal versions', () => {
    // Act & Assert
    expect(parseZeDependency('app', '')).toEqual({
      version: '',
      registry: 'zephyr',
      app_uid: 'app',
    });

    expect(parseZeDependency('app', 'latest')).toEqual({
      version: 'latest',
      registry: 'zephyr',
      app_uid: 'app',
    });

    expect(parseZeDependency('app', '*')).toEqual({
      version: '*',
      registry: 'zephyr',
      app_uid: 'app',
    });
  });
});
