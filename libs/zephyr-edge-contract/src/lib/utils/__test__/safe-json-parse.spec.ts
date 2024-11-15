import { safe_json_parse } from '../safe-json-parse';

describe('safe_json_parse', () => {
  test('should correctly parse valid JSON string', () => {
    const jsonString = '{"key": "value"}';
    const result = safe_json_parse(jsonString);

    expect(result).toEqual({ key: 'value' });
  });

  test('should return undefined for invalid JSON string', () => {
    const jsonString = '{invalid json}';
    const result = safe_json_parse(jsonString);

    expect(result).toBeUndefined();
  });

  test('should handle empty string correctly', () => {
    const jsonString = '';
    const result = safe_json_parse(jsonString);

    expect(result).toBeUndefined();
  });

  test('should handle non-string input gracefully', () => {
    const jsonString = '123';
    const result = safe_json_parse(jsonString);

    expect(result).toBe(123);
  });

  test('should handle boolean JSON correctly', () => {
    const jsonString = 'true';
    const result = safe_json_parse(jsonString);

    expect(result).toBe(true);
  });

  test('should handle array JSON correctly', () => {
    const jsonString = '[1, 2, 3]';
    const result = safe_json_parse(jsonString);

    expect(result).toEqual([1, 2, 3]);
  });

  test('should handle nested JSON objects correctly', () => {
    const jsonString = '{"key": {"nestedKey": "nestedValue"}}';
    const result = safe_json_parse(jsonString);

    expect(result).toEqual({ key: { nestedKey: 'nestedValue' } });
  });
});
