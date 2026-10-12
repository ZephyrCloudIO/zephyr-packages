import type { DoctorEvidence } from '../doctor/schema';

/** Minimum secret patterns from contract section 8.2, applied line by line. */
const SECRET_PATTERNS: readonly RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{36,}/,
  /github_pat_[A-Za-z0-9_]{22,}/,
  /xox[abprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /sk-[A-Za-z0-9_-]{32,}/,
  /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\s]{16,}['"]/i,
];

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * Text a file is scanned as (contract amendment 11.8): UTF-8 when the bytes are valid
 * UTF-8, otherwise latin1 (ISO-8859-1, one character per byte), so a stray byte never
 * switches the scan off and every producer counts the same characters.
 */
export function decodeForSecretScan(bytes: Uint8Array): string {
  try {
    return utf8.decode(bytes);
  } catch {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(
      'latin1'
    );
  }
}

/** Masked evidence for every likely secret in a file, whatever its encoding. */
export function findSecrets(path: string, bytes: Uint8Array): DoctorEvidence[] {
  const text = decodeForSecretScan(bytes);

  const evidence: DoctorEvidence[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const pattern of SECRET_PATTERNS) {
      const match = pattern.exec(line);
      if (match) {
        evidence.push({ path, line: index + 1, detail: maskSecret(match[0]) });
        break;
      }
    }
  });
  return evidence;
}

/** Show only the first 4 characters of a match. */
export function maskSecret(match: string): string {
  return `${match.slice(0, 4)}…`;
}
