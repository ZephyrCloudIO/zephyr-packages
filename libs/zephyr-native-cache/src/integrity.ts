export function normalizeSha256(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
    ? value.toLowerCase()
    : null;
}
