// BDD description (unit tests are generated from this description):
//
// Feature: file selection shared by upload and dry run
//
//   Scenario: no include list (legacy behavior)
//     Given source maps, node_modules, .git, .DS_Store and thumbs.db files
//     When files are selected without include
//     Then they are skipped as legacy-skip and ordinary files are kept
//
//   Scenario: include and exclude globs
//     Given an include list and an exclude list
//     Then files must match include and not exclude; dotfiles are matched by globs
//     And the legacy skip list does not apply, so .map files can be included
//     And unmatched files are reported as not-included, exclude matches name the glob
//
//   Scenario: the denylist wins
//     Given include globs that match .env or .dev.vars
//     Then those files are still excluded with reason denylist
//
//   Scenario: tap-app
//     Given target tap-app without include
//     Then source maps, .git and node_modules files pass through
//     But a credential file such as .env throws naming the file, without the word secret
//
//   Scenario: symlink containment
//     Given an input flagged outsideRoot, or one whose real path is a denylisted file
//     Then it is excluded as outside-root or denylist, before include and exclude
//     And with tap-app both throw
//
//   Scenario: exceptional input
//     Given an empty file list or an empty include list
//     Then nothing is selected and nothing throws
import { describe, expect, it } from '@rstest/core';
import { selectFiles } from './file-selection';

describe('selectFiles without include', () => {
  it('keeps the legacy skip list', () => {
    const result = selectFiles([
      'index.js',
      'index.js.map',
      'node_modules/a/b.js',
      '.git/HEAD',
      '.DS_Store',
      'sub/Thumbs.db',
      'a.css',
    ]);
    expect(result.selected).toEqual(['index.js', 'a.css']);
    expect(result.excluded.filter((e) => e.reason === 'legacy-skip')).toHaveLength(3);
  });

  it('applies the denylist on the legacy path', () => {
    const result = selectFiles(['index.js', '.env', '.dev.vars']);
    expect(result.selected).toEqual(['index.js']);
    expect(result.excluded).toEqual([
      { path: '.env', reason: 'denylist', rule: '.env' },
      { path: '.dev.vars', reason: 'denylist', rule: '.dev.vars' },
    ]);
  });
});

describe('selectFiles with include and exclude', () => {
  it('selects by include and removes by exclude', () => {
    const result = selectFiles(['index.js', 'assets/a.css', 'assets/b.png'], {
      include: ['**/*'],
      exclude: ['**/*.css'],
    });
    expect(result.selected).toEqual(['index.js', 'assets/b.png']);
    expect(result.excluded).toEqual([
      { path: 'assets/a.css', reason: 'exclude', rule: '**/*.css' },
    ]);
  });

  it('reports files that no include glob matches', () => {
    const result = selectFiles(['index.js', 'notes.txt'], { include: ['*.js'] });
    expect(result.selected).toEqual(['index.js']);
    expect(result.excluded).toEqual([
      { path: 'notes.txt', reason: 'not-included', rule: 'include' },
    ]);
  });

  it('matches dotfiles and lets .map files be included explicitly', () => {
    const result = selectFiles(['.well-known/a.json', 'index.js.map'], {
      include: ['**/*'],
    });
    expect(result.selected).toEqual(['.well-known/a.json', 'index.js.map']);
  });

  it('never lets include override the denylist', () => {
    const result = selectFiles(
      ['.env', '.dev.vars', 'wrangler.toml', 'a/.env', 'ok.js'],
      {
        include: ['**/*', '.env', '.*'],
      }
    );
    expect(result.selected).toEqual(['ok.js']);
    expect(result.excluded.every((e) => e.reason === 'denylist')).toBe(true);
  });
});

describe('selectFiles for tap-app', () => {
  it('passes source maps and structural folders through', () => {
    const result = selectFiles(
      [
        'targets.mjs.map',
        '.DS_Store',
        'node_modules/locked/asset.bin',
        '.git/opaque-lock',
      ],
      { target: 'tap-app' }
    );
    expect(result.selected).toEqual([
      'targets.mjs.map',
      '.DS_Store',
      'node_modules/locked/asset.bin',
      '.git/opaque-lock',
    ]);
  });

  it('throws on a credential file instead of omitting it silently', () => {
    expect(() => selectFiles(['a.js', '.env'], { target: 'tap-app' })).toThrow(
      /Refusing to publish \.env/
    );
  });

  it('names the rule without the word that the log redactor mangles', () => {
    try {
      selectFiles(['.env'], { target: 'tap-app' });
      throw new Error('expected a throw');
    } catch (error) {
      expect(String(error)).toContain('never-upload rule');
      expect(String(error)).not.toMatch(/secret/i);
    }
  });
});

describe('selectFiles with symlinks', () => {
  it('excludes a file whose real path is outside the root', () => {
    const result = selectFiles(
      [
        { path: 'config.txt', outsideRoot: true },
        { path: 'index.js', realPath: 'index.js' },
      ],
      { include: ['**/*'] }
    );
    expect(result.selected).toEqual(['index.js']);
    expect(result.excluded).toEqual([
      { path: 'config.txt', reason: 'outside-root', rule: 'symlink' },
    ]);
  });

  it('applies the denylist to the real path', () => {
    const result = selectFiles(
      [
        { path: 'config.txt', realPath: '.env' },
        { path: 'ok.js', realPath: 'lib/ok.js' },
      ],
      { include: ['**/*'] }
    );
    expect(result.selected).toEqual(['ok.js']);
    expect(result.excluded).toEqual([
      { path: 'config.txt', reason: 'denylist', rule: '.env' },
    ]);
  });

  it('throws for tap-app on an outside link or a link to a credential file', () => {
    expect(() =>
      selectFiles([{ path: 'x', outsideRoot: true }], { target: 'tap-app' })
    ).toThrow(/outside the upload folder/);
    expect(() =>
      selectFiles([{ path: 'x', realPath: '.env' }], { target: 'tap-app' })
    ).toThrow(/never-upload rule/);
  });
});

describe('selectFiles exceptional input', () => {
  it('handles an empty list', () => {
    expect(selectFiles([])).toEqual({ selected: [], excluded: [] });
  });

  it('selects nothing for an empty include list', () => {
    const result = selectFiles(['a.js'], { include: [] });
    expect(result.selected).toEqual([]);
    expect(result.excluded[0]?.reason).toBe('not-included');
  });
});
