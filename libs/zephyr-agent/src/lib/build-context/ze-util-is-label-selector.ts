const PARTIAL_VERSION = /^v?(?:\d+|[xX*])(?:\.(?:\d+|[xX*]))?$/;
const EXACT_VERSION = /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/;
const RANGE_OPERATOR = /^[\^~<>=]/;

/**
 * Whether a parsed dependency selector names a tag or environment (e.g. `latest`, `DEMO`,
 * `dev-ios`) rather than the `*` wildcard, the `workspace:` protocol, or a semver version
 * or range. Conservative: anything that looks like a version is not treated as a label.
 */
export function isLabelSelector(selector: string): boolean {
  const value = selector.trim();
  if (value === '' || value === '*' || value.startsWith('workspace:')) return false;
  if (RANGE_OPERATOR.test(value) || value.includes('||') || value.includes(' - ')) {
    return false;
  }
  return !PARTIAL_VERSION.test(value) && !EXACT_VERSION.test(value);
}
