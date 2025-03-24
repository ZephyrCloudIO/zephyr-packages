import { normalizeBasePath } from '../ze-basehref-handler';

describe('ze-basehref-handler', () => {
  describe('normalizeBasePath', () => {
    it('should return empty string for null or undefined', () => {
      expect(normalizeBasePath(null)).toBe('');
      expect(normalizeBasePath(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
      expect(normalizeBasePath('')).toBe('');
    });

    it('should return empty string for root paths', () => {
      expect(normalizeBasePath('/')).toBe('');
      expect(normalizeBasePath('./')).toBe('');
      expect(normalizeBasePath('.')).toBe('');
    });

    it('should remove leading and trailing slashes', () => {
      expect(normalizeBasePath('/path/')).toBe('path');
      expect(normalizeBasePath('/path')).toBe('path');
      expect(normalizeBasePath('path/')).toBe('path');
    });

    it('should remove leading ./ if present', () => {
      expect(normalizeBasePath('./path')).toBe('path');
      expect(normalizeBasePath('./path/')).toBe('path');
    });

    it('should handle nested paths correctly', () => {
      expect(normalizeBasePath('/nested/path/')).toBe('nested/path');
      expect(normalizeBasePath('./nested/path/')).toBe('nested/path');
      expect(normalizeBasePath('nested/path')).toBe('nested/path');
    });

    it('should trim whitespace', () => {
      expect(normalizeBasePath('  path  ')).toBe('path');
      expect(normalizeBasePath('  /path/  ')).toBe('path');
    });

    it('should handle combined cases correctly', () => {
      expect(normalizeBasePath('  ./nested/path/  ')).toBe('nested/path');
      expect(normalizeBasePath('/  nested/path  /')).toBe('nested/path');
    });
  });
});