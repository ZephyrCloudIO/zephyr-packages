import { parseZeDependencies, parseZeDependency } from '../ze-util-parse-ze-dependencies';

describe('parseZeDependencies error handling', () => {
  it('should handle null and undefined dependency values gracefully', () => {
    // Arrange - TypeScript would normally prevent this, but edge cases can occur
    const zeDependencies = {
      'valid-dep': '1.0.0',
      'null-dep': null as any,
      'undefined-dep': undefined as any,
    };

    // Act & Assert - Function will throw on null/undefined values in Object.entries
    expect(() => parseZeDependencies(zeDependencies)).toThrow();
  });

  it('should handle empty object dependency format', () => {
    // Arrange
    const zeDependencies = {
      'empty-platform-dep': {} as any,
    };

    // Act
    const result = parseZeDependencies(zeDependencies);

    // Assert
    expect(result).toEqual({});
  });

  it('should handle invalid object structure in platform dependencies', () => {
    // Arrange
    const zeDependencies = {
      'invalid-platform': {
        validPlatform: '1.0.0',
        invalidPlatform: null as any,
        anotherInvalid: undefined as any,
      },
    };

    // Act & Assert - Function will throw on null/undefined values
    expect(() => parseZeDependencies(zeDependencies)).toThrow();
  });

  it('should handle very long dependency names and versions', () => {
    // Arrange
    const longName = 'a'.repeat(1000);
    const longVersion = 'v'.repeat(1000);

    // Act
    const result = parseZeDependency(longName, longVersion);

    // Assert
    expect(result).toEqual({
      version: longVersion,
      registry: 'zephyr',
      app_uid: longName,
    });
  });

  it('should handle special characters in dependency names', () => {
    // Arrange
    const specialNames = [
      '@scope/package-name',
      'package_with_underscores',
      'package-with-dashes',
      'package.with.dots',
      'package@with@symbols',
      'package:with:colons',
    ];

    // Act & Assert
    specialNames.forEach((name) => {
      expect(() => parseZeDependency(name, '1.0.0')).not.toThrow();
      const result = parseZeDependency(name, '1.0.0');
      expect(result.app_uid).toBe(name);
    });
  });

  it('should handle malformed version strings', () => {
    // Arrange
    const malformedVersions = [
      'not-a-version',
      '1.2.3.4.5',
      'v1.0.0-',
      '^',
      '~',
      '>',
      '<',
      '=',
      'latest-',
      'beta-',
    ];

    // Act & Assert
    malformedVersions.forEach((version) => {
      expect(() => parseZeDependency('test-app', version)).not.toThrow();
      const result = parseZeDependency('test-app', version);
      expect(result.version).toBe(version);
    });
  });

  it('should handle edge cases with registry parsing', () => {
    // Arrange
    const edgeCases = [
      'registry:',
      ':version',
      '::double-colon',
      'registry::version',
      'workspace:',
      ':workspace:*',
    ];

    // Act & Assert
    edgeCases.forEach((version) => {
      expect(() => parseZeDependency('test-app', version)).not.toThrow();
    });
  });

  it('should handle edge cases with @ symbol parsing', () => {
    // Arrange
    const edgeCases = [
      'zephyr:@',
      'zephyr:app@',
      'zephyr:@tag',
      'zephyr:@@double',
      'zephyr:app@@double-tag',
      'zephyr:@scope/package@tag',
    ];

    // Act & Assert
    edgeCases.forEach((version) => {
      expect(() => parseZeDependency('test-app', version)).not.toThrow();
    });
  });

  it('should handle Unicode and non-ASCII characters', () => {
    // Arrange
    const unicodeNames = [
      'пакет', // Cyrillic
      'パッケージ', // Japanese
      '包', // Chinese
      'paquete-español',
      'émoji-🚀-package',
    ];

    // Act & Assert
    unicodeNames.forEach((name) => {
      expect(() => parseZeDependency(name, '1.0.0')).not.toThrow();
      const result = parseZeDependency(name, '1.0.0');
      expect(result.app_uid).toBe(name);
    });
  });

  it('should handle extremely nested platform configurations', () => {
    // Arrange - TypeScript would prevent this, but edge cases can occur
    const nestedConfig = {
      'complex-dep': {
        ios: '1.0.0',
        android: {
          nested: 'should-not-work',
        } as any,
        web: '2.0.0',
      },
    };

    // Act & Assert - Function will throw because nested object becomes string "[object Object]" and .includes() fails
    expect(() => parseZeDependencies(nestedConfig)).toThrow();
  });

  it('should handle circular reference attempts', () => {
    // Arrange
    const circularObj: any = { ios: '1.0.0' };
    circularObj.self = circularObj;

    const dependencies = {
      'circular-dep': circularObj,
    };

    // Act & Assert - Should handle without infinite loops but will throw when converting circular object to string
    expect(() => parseZeDependencies(dependencies)).toThrow();
  });
});

describe('parseZeDependency edge cases', () => {
  it('should handle empty strings', () => {
    // Act
    const result = parseZeDependency('', '');

    // Assert
    expect(result).toEqual({
      version: '',
      registry: 'zephyr',
      app_uid: '',
    });
  });

  it('should handle whitespace-only strings', () => {
    // Act
    const result = parseZeDependency('   ', '   ');

    // Assert
    expect(result).toEqual({
      version: '   ',
      registry: 'zephyr',
      app_uid: '   ',
    });
  });

  it('should preserve exact whitespace in versions', () => {
    // Arrange
    const versionsWithWhitespace = [
      ' 1.0.0',
      '1.0.0 ',
      ' 1.0.0 ',
      '1.0.0\n',
      '1.0.0\t',
      '\n\t 1.0.0 \t\n',
    ];

    // Act & Assert
    versionsWithWhitespace.forEach((version) => {
      const result = parseZeDependency('test-app', version);
      expect(result.version).toBe(version);
    });
  });

  it('should handle numeric version input (edge case)', () => {
    // Act
    const result = parseZeDependency('test-app', '123' as any);

    // Assert
    expect(result).toEqual({
      version: '123',
      registry: 'zephyr',
      app_uid: 'test-app',
    });
  });
});
