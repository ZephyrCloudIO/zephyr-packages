import { describe, expect, it } from '@rstest/core';
import * as fs from 'node:fs';
import path from 'node:path';

interface PackageManifest {
  version: string;
  files: string[];
  keywords: string[];
  scripts: Record<string, string>;
  intent: {
    version: number;
    repo: string;
    docs: string;
    requires: string[];
  };
}

interface PluginManifest {
  name: string;
  version: string;
  skills?: string;
}

const packageRoot = path.resolve(import.meta.dirname, '..');

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, relativePath), 'utf8')) as T;
}

describe('published Agent Skill envelope', () => {
  const packageManifest = readJson<PackageManifest>('package.json');
  const pluginManifests = [
    readJson<PluginManifest>('.codex-plugin/plugin.json'),
    readJson<PluginManifest>('.claude-plugin/plugin.json'),
    readJson<PluginManifest>('.cursor-plugin/plugin.json'),
  ];

  it('ships one canonical skill and all thin host manifests', () => {
    expect(packageManifest.files).toEqual(
      expect.arrayContaining([
        'skills',
        '.codex-plugin/plugin.json',
        '.claude-plugin/plugin.json',
        '.cursor-plugin/plugin.json',
        'scripts/sync-plugin-versions.mjs',
      ])
    );
    expect(packageManifest.keywords).toEqual(
      expect.arrayContaining(['agent-skill', 'tanstack-intent'])
    );

    for (const manifest of pluginManifests) {
      expect(manifest.name).toBe('create-zephyr-apps');
      expect(manifest.version).toBe(packageManifest.version);
    }
    expect(pluginManifests[0]?.skills).toBe('./skills/');
    expect(pluginManifests[2]?.skills).toBe('./skills/');
    expect(packageManifest.scripts.version).toBe('node scripts/sync-plugin-versions.mjs');
  });

  it('uses standard skill frontmatter and explicit Intent metadata', () => {
    const skill = fs.readFileSync(
      path.join(packageRoot, 'skills/create-zephyr-apps/SKILL.md'),
      'utf8'
    );
    const frontmatter = skill.split('---', 3)[1];

    expect(frontmatter).toContain('name: create-zephyr-apps');
    expect(frontmatter).toContain('description:');
    expect(frontmatter).not.toMatch(/^version:/mu);
    expect(packageManifest.intent).toEqual({
      version: 1,
      repo: 'ZephyrCloudIO/zephyr-packages',
      docs: 'https://docs.zephyr-cloud.io/tools/create-zephyr-apps',
      requires: [],
    });
  });
});
