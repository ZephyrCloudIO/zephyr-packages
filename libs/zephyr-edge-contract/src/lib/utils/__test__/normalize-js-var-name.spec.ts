import { normalize_js_var_name } from '../normalize-js-var-name';

describe('normalize_js_var_name', () => {
  test('should handle valid variable names unchanged', () => {
    expect(normalize_js_var_name('validName')).toBe('validName');
    expect(normalize_js_var_name('_validName')).toBe('_validName');
    expect(normalize_js_var_name('$validName')).toBe('$validName');
    expect(normalize_js_var_name('valid123')).toBe('valid123');
    expect(normalize_js_var_name('valid_name_123')).toBe('valid_name_123');
  });

  test('should replace invalid starting characters with underscore', () => {
    expect(normalize_js_var_name('1invalid')).toBe('_invalid');
    expect(normalize_js_var_name('123name')).toBe('_23name');
    expect(normalize_js_var_name('-invalid')).toBe('_invalid');
    expect(normalize_js_var_name('.invalid')).toBe('_invalid');
    expect(normalize_js_var_name('@invalid')).toBe('_invalid');
    expect(normalize_js_var_name('#invalid')).toBe('_invalid');
  });

  test('should replace invalid characters with underscore', () => {
    expect(normalize_js_var_name('invalid-name')).toBe('invalid_name');
    expect(normalize_js_var_name('invalid.name')).toBe('invalid_name');
    expect(normalize_js_var_name('invalid@name')).toBe('invalid_name');
    expect(normalize_js_var_name('invalid#name')).toBe('invalid_name');
    expect(normalize_js_var_name('invalid name')).toBe('invalid_name');
    expect(normalize_js_var_name('invalid/name')).toBe('invalid_name');
    expect(normalize_js_var_name('invalid\\name')).toBe('invalid_name');
  });

  test('should handle multiple invalid characters', () => {
    expect(normalize_js_var_name('1invalid-name.test@example')).toBe(
      '_invalid_name_test_example'
    );
    expect(normalize_js_var_name('123-test.name@domain')).toBe('_23_test_name_domain');
    expect(normalize_js_var_name('---invalid---')).toBe('___invalid___');
  });

  test('should handle special characters', () => {
    expect(normalize_js_var_name('name!@#$%^&*()')).toBe('name___$______');
    expect(normalize_js_var_name('name+=-[]{}|;:,<>?')).toBe('name______________');
    expect(normalize_js_var_name('name"\'`~')).toBe('name____');
  });

  test('should handle unicode characters', () => {
    expect(normalize_js_var_name('café')).toBe('caf_');
    expect(normalize_js_var_name('naïve')).toBe('na_ve');
    expect(normalize_js_var_name('résumé')).toBe('r_sum_');
  });

  test('should handle edge cases', () => {
    expect(normalize_js_var_name('')).toBe('');
    expect(normalize_js_var_name('_')).toBe('_');
    expect(normalize_js_var_name('$')).toBe('$');
    expect(normalize_js_var_name('a')).toBe('a');
    expect(normalize_js_var_name('1')).toBe('_');
  });

  test('should preserve valid dollar signs and underscores', () => {
    expect(normalize_js_var_name('$_valid_name_$')).toBe('$_valid_name_$');
    expect(normalize_js_var_name('__proto__')).toBe('__proto__');
    expect(normalize_js_var_name('$1')).toBe('$1');
  });

  test('should handle consecutive invalid characters', () => {
    expect(normalize_js_var_name('name---test')).toBe('name___test');
    expect(normalize_js_var_name('name...test')).toBe('name___test');
    expect(normalize_js_var_name('name   test')).toBe('name___test');
  });

  test('should handle common package/module name patterns', () => {
    expect(normalize_js_var_name('@scope/package-name')).toBe('_scope_package_name');
    expect(normalize_js_var_name('lodash.debounce')).toBe('lodash_debounce');
    expect(normalize_js_var_name('react-dom')).toBe('react_dom');
    expect(normalize_js_var_name('my-awesome-lib')).toBe('my_awesome_lib');
  });

  test('should handle numbers in valid positions', () => {
    expect(normalize_js_var_name('name1')).toBe('name1');
    expect(normalize_js_var_name('name123')).toBe('name123');
    expect(normalize_js_var_name('test2Name')).toBe('test2Name');
    expect(normalize_js_var_name('_123')).toBe('_123');
    expect(normalize_js_var_name('$123')).toBe('$123');
  });
});
