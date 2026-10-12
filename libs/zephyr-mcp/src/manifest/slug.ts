const MAX_SLUG_LENGTH = 64;

/**
 * A provider or application name from a package or repository name: lowercase, without an
 * `@scope/`, runs of other characters turned into `-`, trimmed, at most 64 characters.
 * Throws when nothing is left.
 *
 * @example
 *   ```ts
 *   slug('@acme/billing-agent'); // 'billing-agent'
 *   slug('Billing_Agent'); // 'billing-agent'
 *   ```;
 */
export function slug(value: string): string {
  const result = value
    .toLowerCase()
    .replace(/^@[^/]*\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
  if (!result) {
    throw new Error(
      `Cannot derive a name from "${value}": it has no letters or digits. Pass a name explicitly, e.g. { name: 'billing-tools' }`
    );
  }
  return result;
}
