export type JwtPayload = Record<string, unknown>;

export function stringifyId(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return String(value);
  }

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function decodeJwtPayload(token: string | undefined): JwtPayload | undefined {
  const payload = token?.split('.')[1];
  if (!payload) {
    return undefined;
  }

  try {
    return JSON.parse(
      Buffer.from(toBase64(payload), 'base64').toString('utf8')
    ) as JwtPayload;
  } catch {
    return undefined;
  }
}

export function getEmailClaims(
  payload: JwtPayload | undefined,
  keys: string[]
): string[] {
  if (!payload) {
    return [];
  }

  return getEmails(keys.map((key) => payload[key]));
}

export function getStringClaim(
  payload: JwtPayload | undefined,
  keys: string[]
): string | undefined {
  if (!payload) {
    return undefined;
  }

  return keys
    .map((key) => stringifyId(payload[key]))
    .find((value): value is string => Boolean(value));
}

export function getEmails(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => getEmail(value))
        .filter((email): email is string => Boolean(email))
    )
  );
}

export function getEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
}

export function claimMatchesEnv(
  payload: JwtPayload,
  claim: string,
  expected: string | undefined
): boolean {
  if (!expected || payload[claim] === undefined || payload[claim] === null) {
    return true;
  }

  return String(payload[claim]) === expected;
}

function toBase64(base64Url: string): string {
  const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
}
