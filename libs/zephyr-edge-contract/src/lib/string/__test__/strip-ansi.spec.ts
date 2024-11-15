import { stripAnsi } from '../strip-ansi';

describe('stripAnsi', () => {
  test('should remove ANSI escape codes from a string', () => {
    const input = '\u001B[4mUnicorn\u001B[0m';
    const result = stripAnsi(input);

    expect(result).toBe('Unicorn');
  });

  test('should remove complex ANSI escape sequences', () => {
    const input = '\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007';
    const result = stripAnsi(input);

    expect(result).toBe('Click');
  });

  test('should handle strings without ANSI codes correctly', () => {
    const input = 'Just a normal string';
    const result = stripAnsi(input);

    expect(result).toBe('Just a normal string');
  });

  test('should handle empty strings', () => {
    const input = '';
    const result = stripAnsi(input);

    expect(result).toBe('');
  });

  test('should remove multiple ANSI escape codes in a string', () => {
    const input = '\u001B[31mRed\u001B[39m \u001B[32mGreen\u001B[39m';
    const result = stripAnsi(input);

    expect(result).toBe('Red Green');
  });
});
