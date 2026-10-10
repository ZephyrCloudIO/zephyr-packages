import { decodeUtf8 } from '../mime';

/**
 * Likely secrets, applied line by line. The list is the contract's minimum; a match is
 * only ever shown masked.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{36,}/,
  /github_pat_[A-Za-z0-9_]{22,}/,
  /xox[abprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /sk-[A-Za-z0-9_-]{32,}/,
  /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\s]{16,}['"]/i,
];

// One character per byte. Not TextDecoder('latin1'), which is windows-1252
// and not available everywhere the checks run.
const decodeLatin1 = (bytes: Uint8Array): string => {
  let text = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return text;
};

/**
 * The text a file is scanned as: UTF-8 when it is valid UTF-8, else its bytes as latin1,
 * so a key in a binary or latin1 file is still found.
 */
export const textForSecretScan = (bytes: Uint8Array): string =>
  decodeUtf8(bytes) ?? decodeLatin1(bytes);

/** The first 4 characters of a match followed by `…`. */
export const maskSecret = (match: string): string => `${match.slice(0, 4)}…`;

/** One likely secret per line: its 1-based line number and the masked match. */
export const findSecrets = (text: string): Array<{ line: number; masked: string }> => {
  const found: Array<{ line: number; masked: string }> = [];
  text.split('\n').forEach((line, index) => {
    for (const pattern of SECRET_PATTERNS) {
      const match = pattern.exec(line);
      if (match) {
        found.push({ line: index + 1, masked: maskSecret(match[0]) });
        return;
      }
    }
  });
  return found;
};
