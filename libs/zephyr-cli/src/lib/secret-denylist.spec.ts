// BDD description (unit tests are generated from this description):
//
// Feature: secret denylist
//   Files that can hold secrets are never uploaded, whatever the configuration says.
//
//   Scenario: every denylist rule blocks its files
//     Given a path such as .env, .env.production, .dev.vars, wrangler.toml, server.pem,
//       id_rsa.pub, .git/config or node_modules/a/index.js
//     When the path is checked
//     Then the matching rule is returned
//
//   Scenario: nested and upper-case paths are blocked
//     Given a/b/.env, config/KEY.PEM or app/.SSH/id
//     Then the rule is returned
//
//   Scenario: more credential files are blocked
//     Given .envrc, .git-credentials, AuthKey.p8, .yarnrc.yml, .pypirc, .docker/config.json,
//       .kube/config, .gnupg/key, key.ppk, terraform.tfstate, terraform.tfstate.backup or
//       .htpasswd
//     Then the matching rule is returned
//
//   Scenario: trailing whitespace does not hide a file
//     Given ".env " or "dir /.env"
//     Then the rule is returned
//
//   Scenario: each rule has a kind
//     Given .git/** and node_modules/** (structural) and every other rule (credential)
//     Then matchDenylist reports the kind, and a credential hit inside .git wins
//
//   Scenario: look-alike names pass
//     Given environment.js, keys.json, monkey.txt, src/envelope.ts or tfstate.txt
//     Then no rule is returned
//
//   Scenario: exceptional input
//     Given an empty path, or a path using backslashes
//     Then the empty path passes and the backslash path is still checked
import { describe, expect, it } from '@rstest/core';
import { matchDenylist, matchSecretDenylist } from './secret-denylist';

describe('matchSecretDenylist', () => {
  it.each([
    ['.env', '.env'],
    ['.env.production', '.env.*'],
    ['.dev.vars', '.dev.vars'],
    ['.dev.vars.staging', '.dev.vars.*'],
    ['.git/config', '.git/**'],
    ['node_modules/a/index.js', 'node_modules/**'],
    ['.ssh/known_hosts', '.ssh/**'],
    ['.aws/credentials', '.aws/**'],
    ['.npmrc', '.npmrc'],
    ['.netrc', '.netrc'],
    ['wrangler.toml', 'wrangler.toml'],
    ['wrangler.json', 'wrangler.json'],
    ['wrangler.jsonc', 'wrangler.jsonc'],
    ['server.pem', '*.pem'],
    ['tls.key', '*.key'],
    ['cert.p12', '*.p12'],
    ['cert.pfx', '*.pfx'],
    ['store.jks', '*.jks'],
    ['release.keystore', '*.keystore'],
    ['id_rsa', 'id_rsa*'],
    ['id_rsa.pub', 'id_rsa*'],
    ['id_dsa', 'id_dsa*'],
    ['id_ecdsa', 'id_ecdsa*'],
    ['id_ed25519', 'id_ed25519*'],
    ['.envrc', '.envrc'],
    ['.git-credentials', '.git-credentials'],
    ['AuthKey_ABC.p8', '*.p8'],
    ['.yarnrc.yml', '.yarnrc.yml'],
    ['.pypirc', '.pypirc'],
    ['.docker/config.json', '.docker/**'],
    ['.kube/config', '.kube/**'],
    ['.gnupg/pubring.kbx', '.gnupg/**'],
    ['key.ppk', '*.ppk'],
    ['terraform.tfstate', '*.tfstate'],
    ['terraform.tfstate.backup', '*.tfstate.*'],
    ['.htpasswd', '.htpasswd'],
  ])('blocks %s with rule %s', (path, rule) => {
    expect(matchSecretDenylist(path)).toBe(rule);
  });

  it('blocks nested and upper-case paths', () => {
    expect(matchSecretDenylist('a/b/.env')).toBe('.env');
    expect(matchSecretDenylist('config/KEY.PEM')).toBe('*.pem');
    expect(matchSecretDenylist('app/.SSH/id')).toBe('.ssh/**');
    expect(matchSecretDenylist('a/.git/hooks/pre-commit')).toBe('.git/**');
    expect(matchSecretDenylist('sub/Wrangler.TOML')).toBe('wrangler.toml');
  });

  it('lets look-alike names pass', () => {
    for (const path of [
      'environment.js',
      'keys.json',
      'tfstate.txt',
      'monkey.txt',
      'src/envelope.ts',
      'index.js',
      'assets/a.css',
      '.well-known/security.txt',
    ]) {
      expect(matchSecretDenylist(path)).toBeUndefined();
    }
  });

  it('ignores trailing whitespace on a path segment', () => {
    expect(matchSecretDenylist('.env ')).toBe('.env');
    expect(matchSecretDenylist('dir /.env\t')).toBe('.env');
    expect(matchSecretDenylist('.ssh /id')).toBe('.ssh/**');
  });

  it('reports the rule kind and lets a credential hit win over a structural one', () => {
    expect(matchDenylist('.git/config')).toEqual({ rule: '.git/**', kind: 'structural' });
    expect(matchDenylist('node_modules/a.js')).toEqual({
      rule: 'node_modules/**',
      kind: 'structural',
    });
    expect(matchDenylist('.env')).toEqual({ rule: '.env', kind: 'credential' });
    expect(matchDenylist('.git/.env')).toEqual({ rule: '.env', kind: 'credential' });
    expect(matchDenylist('index.js')).toBeUndefined();
  });

  it('handles an empty path and backslash separators', () => {
    expect(matchSecretDenylist('')).toBeUndefined();
    expect(matchSecretDenylist('a\\b\\.env')).toBe('.env');
  });
});
