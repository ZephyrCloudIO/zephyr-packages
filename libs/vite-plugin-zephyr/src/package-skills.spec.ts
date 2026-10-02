import { afterEach, describe, expect, test } from '@rstest/core';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  packagesWithoutDedicatedSkill,
  publishedPackages,
  sharedSkills,
  syncPackageSkills,
} from '../../../scripts/sync-package-skills.mjs';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const directory of temporaryRoots.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'zephyr-shared-skills-test-'));
  temporaryRoots.push(root);
  const packageRoot = path.join(root, 'package');
  const sourceRoot = path.join(root, 'canonical');
  mkdirSync(packageRoot);
  writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({
      name: 'fixture-plugin',
      version: '1.0.0',
      files: ['skills'],
      keywords: ['tanstack-intent'],
    })
  );
  for (const skill of sharedSkills) {
    const directory = path.join(sourceRoot, skill);
    mkdirSync(path.join(directory, 'references'), { recursive: true });
    writeFileSync(
      path.join(directory, 'SKILL.md'),
      `---\nname: ${skill}\ndescription: fixture guide\n---\n`
    );
    writeFileSync(path.join(directory, 'references/guide.md'), 'Canonical guidance\n');
  }
  return { packageRoot, sourceRoot };
}

describe('shared skill distribution', () => {
  test('mirrors canonical guides without replacing a package-specific skill', () => {
    const { packageRoot, sourceRoot } = fixture();
    const dedicatedDirectory = path.join(packageRoot, 'skills/dedicated');
    mkdirSync(dedicatedDirectory, { recursive: true });
    writeFileSync(
      path.join(dedicatedDirectory, 'SKILL.md'),
      'Package-specific guidance\n'
    );
    syncPackageSkills(packageRoot, sourceRoot);
    const staleFile = path.join(packageRoot, 'skills/zephyr-core/references/stale.md');
    writeFileSync(staleFile, 'Old generated output\n');
    writeFileSync(
      path.join(sourceRoot, 'zephyr-core/references/guide.md'),
      'Updated canonical guidance\n'
    );
    syncPackageSkills(packageRoot, sourceRoot);
    expect(
      readFileSync(
        path.join(packageRoot, 'skills/zephyr-core/references/guide.md'),
        'utf8'
      )
    ).toBe('Updated canonical guidance\n');
    expect(() => readFileSync(staleFile)).toThrow();
    expect(readFileSync(path.join(dedicatedDirectory, 'SKILL.md'), 'utf8')).toBe(
      'Package-specific guidance\n'
    );
  });

  test('rejects private packages and missing publishing metadata', () => {
    const { packageRoot, sourceRoot } = fixture();
    writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({ name: 'private-tool', private: true })
    );
    expect(() => syncPackageSkills(packageRoot, sourceRoot)).toThrow('private package');
    writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({ name: 'unprepared-plugin' })
    );
    expect(() => syncPackageSkills(packageRoot, sourceRoot)).toThrow(
      'must include skills'
    );
  });

  test('refuses authored or symlinked shared destinations', () => {
    const { packageRoot, sourceRoot } = fixture();
    const destination = path.join(packageRoot, 'skills/zephyr-core');
    mkdirSync(destination, { recursive: true });
    writeFileSync(path.join(destination, 'SKILL.md'), 'Authored package guidance\n');
    expect(() => syncPackageSkills(packageRoot, sourceRoot)).toThrow('authored skill');
    expect(readFileSync(path.join(destination, 'SKILL.md'), 'utf8')).toBe(
      'Authored package guidance\n'
    );
    rmSync(destination, { recursive: true });
    symlinkSync(
      path.join(sourceRoot, 'zephyr-core'),
      destination,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    expect(() => syncPackageSkills(packageRoot, sourceRoot)).toThrow('authored skill');
  });

  test('every published workspace package has a pack hook and skill allowlist', () => {
    for (const directory of publishedPackages()) {
      const manifest = JSON.parse(
        readFileSync(path.join(directory, 'package.json'), 'utf8')
      );
      expect(manifest.files).toContain('skills');
      expect(manifest.keywords).toContain('tanstack-intent');
      expect(manifest.scripts.prepack).toContain('sync-package-skills.mjs');
    }
  });

  test('every published build integration authors a dedicated skill', () => {
    const missing = publishedPackages()
      .map((directory) => ({
        directory,
        name: JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')).name,
      }))
      .filter(({ name }) => !packagesWithoutDedicatedSkill.includes(name))
      .filter(({ directory }) => {
        const skillsDirectory = path.join(directory, 'skills');
        return (
          !existsSync(skillsDirectory) ||
          !readdirSync(skillsDirectory, { withFileTypes: true }).some(
            (entry) =>
              entry.isDirectory() &&
              !sharedSkills.includes(entry.name) &&
              existsSync(path.join(skillsDirectory, entry.name, 'SKILL.md'))
          )
        );
      })
      .map(({ name }) => name);
    expect(missing).toEqual([]);
  });
});
