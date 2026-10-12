const encoder = new TextEncoder();

/**
 * Sha256 of raw bytes as 64 lowercase hex characters, with Web Crypto, so it runs in
 * Workers and Node alike. Strings are hashed as UTF-8.
 *
 * @example
 *   ```ts
 *   await sha256Hex(''); // 'e3b0c442...b855'
 *   ```;
 */
export async function sha256Hex(
  input: Uint8Array | ArrayBuffer | string
): Promise<string> {
  const bytes =
    typeof input === 'string'
      ? encoder.encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  // Copy into a plain ArrayBuffer: Web Crypto rejects SharedArrayBuffer views.
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}
