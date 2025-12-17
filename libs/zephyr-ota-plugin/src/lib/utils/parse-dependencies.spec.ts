import {
  parseZephyrProtocol,
  parseZephyrDependency,
  parseZephyrDependencies,
  isValidZephyrProtocol,
} from './parse-dependencies';

describe('parseZephyrProtocol', () => {
  it('should parse valid zephyr protocol string', () => {
    const result = parseZephyrProtocol('zephyr:myapp.myproject.myorg@staging');

    expect(result).toEqual({
      applicationUid: 'myapp.myproject.myorg',
      versionTag: 'staging',
    });
  });

  it('should parse protocol with production tag', () => {
    const result = parseZephyrProtocol('zephyr:myapp.myproject.myorg@production');

    expect(result).toEqual({
      applicationUid: 'myapp.myproject.myorg',
      versionTag: 'production',
    });
  });

  it('should parse protocol with version tag', () => {
    const result = parseZephyrProtocol('zephyr:myapp.myproject.myorg@v1.2.3');

    expect(result).toEqual({
      applicationUid: 'myapp.myproject.myorg',
      versionTag: 'v1.2.3',
    });
  });

  it('should return null for invalid format without zephyr prefix', () => {
    expect(parseZephyrProtocol('myapp.myproject.myorg@staging')).toBeNull();
  });

  it('should return null for invalid format without @ symbol', () => {
    expect(parseZephyrProtocol('zephyr:myapp.myproject.myorg')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseZephyrProtocol('')).toBeNull();
  });

  it('should return null for URL format', () => {
    expect(parseZephyrProtocol('http://localhost:8080/remote.js')).toBeNull();
  });
});

describe('parseZephyrDependency', () => {
  it('should parse valid dependency with name', () => {
    const result = parseZephyrDependency(
      'MFTextEditor',
      'zephyr:mftexteditor.myproject.myorg@staging'
    );

    expect(result).toEqual({
      name: 'MFTextEditor',
      applicationUid: 'mftexteditor.myproject.myorg',
      versionTag: 'staging',
    });
  });

  it('should return null for invalid protocol string', () => {
    const result = parseZephyrDependency(
      'MFTextEditor',
      'invalid-protocol-string'
    );

    expect(result).toBeNull();
  });
});

describe('parseZephyrDependencies', () => {
  it('should parse multiple dependencies', () => {
    const dependencies = {
      MFTextEditor: 'zephyr:mftexteditor.myproject.myorg@staging',
      MFNotesList: 'zephyr:mfnoteslist.myproject.myorg@staging',
    };

    const result = parseZephyrDependencies(dependencies);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'MFTextEditor',
      applicationUid: 'mftexteditor.myproject.myorg',
      versionTag: 'staging',
    });
    expect(result[1]).toEqual({
      name: 'MFNotesList',
      applicationUid: 'mfnoteslist.myproject.myorg',
      versionTag: 'staging',
    });
  });

  it('should filter out invalid entries', () => {
    const dependencies = {
      MFTextEditor: 'zephyr:mftexteditor.myproject.myorg@staging',
      InvalidRemote: 'http://localhost:8080/remote.js',
    };

    const result = parseZephyrDependencies(dependencies);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('MFTextEditor');
  });

  it('should return empty array for empty config', () => {
    const result = parseZephyrDependencies({});

    expect(result).toHaveLength(0);
  });
});

describe('isValidZephyrProtocol', () => {
  it('should return true for valid protocol', () => {
    expect(isValidZephyrProtocol('zephyr:myapp.myproject.myorg@staging')).toBe(true);
  });

  it('should return false for invalid protocol', () => {
    expect(isValidZephyrProtocol('invalid')).toBe(false);
  });

  it('should return false for URL', () => {
    expect(isValidZephyrProtocol('http://localhost:8080/remote.js')).toBe(false);
  });
});
