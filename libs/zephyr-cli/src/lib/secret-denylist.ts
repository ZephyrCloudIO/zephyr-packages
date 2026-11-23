import picomatch from 'picomatch';

export type DenylistRuleKind = 'credential' | 'structural';

export interface DenylistMatch {
  rule: string;
  /**
   * `credential` rules guard sensitive files and apply to every target, including
   * `tap-app`. `structural` rules (`.git`, `node_modules`) only keep repository and
   * dependency folders out of web uploads; `tap-app` publishes its locked output as is.
   */
  kind: DenylistRuleKind;
}

/**
 * Files that are never uploaded, on every code path.
 *
 * This is a safety invariant, not a setting: it is deliberately not configurable, and an
 * `include` glob cannot override it. It is therefore not subject to the "no defaults"
 * configuration rule.
 */
const STRUCTURAL_PATTERNS: readonly string[] = Object.freeze([
  '.git/**',
  'node_modules/**',
]);

const CREDENTIAL_PATTERNS: readonly string[] = Object.freeze([
  '.env',
  '.env.*',
  '.envrc',
  '.dev.vars',
  '.dev.vars.*',
  '.ssh/**',
  '.aws/**',
  '.docker/**',
  '.kube/**',
  '.gnupg/**',
  '.npmrc',
  '.yarnrc.yml',
  '.pypirc',
  '.netrc',
  '.git-credentials',
  '.htpasswd',
  'wrangler.toml',
  'wrangler.json',
  'wrangler.jsonc',
  '*.pem',
  '*.key',
  '*.p8',
  '*.p12',
  '*.pfx',
  '*.jks',
  '*.keystore',
  '*.ppk',
  '*.tfstate',
  '*.tfstate.*',
  'id_rsa*',
  'id_dsa*',
  'id_ecdsa*',
  'id_ed25519*',
]);

interface CompiledRule extends DenylistMatch {
  matches: (candidate: string) => boolean;
}

function compileRules(
  patterns: readonly string[],
  kind: DenylistRuleKind
): CompiledRule[] {
  return patterns.map((rule) => ({
    rule,
    kind,
    matches: picomatch(rule, { dot: true, nocase: true }),
  }));
}

// Order matters: the first match is reported, and the historic order listed `.git` and
// `node_modules` among the credential rules, so keep structural rules last.
const COMPILED_RULES: readonly CompiledRule[] = [
  ...compileRules(CREDENTIAL_PATTERNS, 'credential'),
  ...compileRules(STRUCTURAL_PATTERNS, 'structural'),
];

/**
 * Returns the rule and kind that block `relativePath`, or `undefined` when the path is
 * allowed. Every rule is tested against the whole path and against each suffix that
 * starts at a path segment, so `a/b/.env` and `a/.git/config` are both caught. Trailing
 * whitespace on a segment is ignored, because `.env ` is the same file on some systems.
 */
export function matchDenylist(relativePath: string): DenylistMatch | undefined {
  const segments = relativePath
    .split(/[/\\]/)
    .map((segment) => segment.trimEnd())
    .filter((segment) => segment !== '');
  let structural: DenylistMatch | undefined;
  for (let start = 0; start < segments.length; start++) {
    const candidate = segments.slice(start).join('/');
    for (const { rule, kind, matches } of COMPILED_RULES) {
      if (!matches(candidate)) continue;
      // A credential hit anywhere in the path wins over a structural one, so
      // `.git/.env` still counts as a credential file.
      if (kind === 'credential') return { rule, kind };
      structural ??= { rule, kind };
    }
  }
  return structural;
}

/** Same as `matchDenylist`, but returns only the rule text. */
export function matchSecretDenylist(relativePath: string): string | undefined {
  return matchDenylist(relativePath)?.rule;
}
