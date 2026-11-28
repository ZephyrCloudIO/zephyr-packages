// BDD description (unit tests are generated from this description):
//
// Feature: relative path and glob rule shared by flags and the config schema
//
//   Scenario: relative paths and globs pass
//     Given ".", "dist", "assets/**", "**/*.css" or ".well-known/a.json"
//     Then isRelativePathOrGlob is true and assertRelativePathOrGlob does not throw
//
//   Scenario: unsafe values are rejected
//     Given "..", "../x", "a/../b", "/abs", "\\\\server\\share", "C:/x", "c:x",
//       "assets\\**" (a backslash anywhere) or an empty string
//     Then isRelativePathOrGlob is false and assertRelativePathOrGlob throws a message
//       that names the label, the value and the rule
//
//   Scenario: look-alikes are not mistaken for parent segments
//     Given "..a", "a..b" or "a/..b/c"
//     Then they pass
import { describe, expect, it } from '@rstest/core';
import {
  RELATIVE_PATH_RULE,
  assertRelativePathOrGlob,
  isRelativePathOrGlob,
} from './path-rules';

describe('isRelativePathOrGlob', () => {
  it.each([
    '.',
    'dist',
    'assets/**',
    '**/*.css',
    '.well-known/a.json',
    '..a',
    'a..b',
    'a/..b/c',
  ])('accepts %s', (value) => {
    expect(isRelativePathOrGlob(value)).toBe(true);
    expect(() => assertRelativePathOrGlob(value, '--output')).not.toThrow();
  });

  it.each([
    '..',
    '../x',
    'a/../b',
    'a/..',
    '/abs',
    '\\\\server\\share',
    '\\abs',
    'C:/x',
    'c:x',
    'assets\\**',
    'a\\b',
    '',
  ])('rejects %s', (value) => {
    expect(isRelativePathOrGlob(value)).toBe(false);
  });
});

describe('assertRelativePathOrGlob', () => {
  it('names the label, the value and the rule', () => {
    expect(() => assertRelativePathOrGlob('..', '--output')).toThrow(
      `--output ${RELATIVE_PATH_RULE}: ".."`
    );
    expect(() => assertRelativePathOrGlob('assets\\**', '--exclude')).toThrow(
      /--exclude must be a relative path using '\/', without '\.\.' or a drive letter/
    );
  });
});
