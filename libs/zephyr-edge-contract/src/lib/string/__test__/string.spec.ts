import { formatString } from '../string';

describe('formatString', () => {
  test('should replace placeholders with provided values', () => {
    const str = 'Hello, {{ name }}!';
    const params = { name: 'John' };
    const result = formatString(str, params);

    expect(result).toBe('Hello, John!');
  });

  test('should replace multiple placeholders with provided values', () => {
    const str = '{{ greeting }}, {{ name }}!';
    const params = { greeting: 'Hi', name: 'Alice' };
    const result = formatString(str, params);

    expect(result).toBe('Hi, Alice!');
  });

  test('should use default value if placeholder is not provided in params', () => {
    const str = 'Hello, {{ name = Guest }}!';
    const params = {};
    const result = formatString(str, params as Record<string, string>);

    expect(result).toBe('Hello, Guest!');
  });

  test('should use key if neither value nor default is provided', () => {
    const str = 'Hello, {{ name }}!';
    const params = {};
    const result = formatString(str, params as Record<string, string>);

    expect(result).toBe('Hello, name!');
  });

  test('should handle boolean, number, and string values', () => {
    const str = '{{ boolValue }}, {{ numValue }}, {{ strValue }}';
    const params = { boolValue: true, numValue: 42, strValue: 'Test' };
    const result = formatString(str, params);

    expect(result).toBe('true, 42, Test');
  });

  test('should handle missing placeholders gracefully', () => {
    const str = 'No placeholders here!';
    const params = { name: 'Ignored' };
    const result = formatString(str, params);

    expect(result).toBe('No placeholders here!');
  });
});
