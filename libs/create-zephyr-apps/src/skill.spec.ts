import { describe, expect, it } from '@rstest/core';
import * as fs from 'node:fs';
import path from 'node:path';

const skillPath = path.resolve(
  import.meta.dirname,
  '../../../skills/create-zephyr-apps/SKILL.md'
);

describe('create-zephyr-apps Agent Skill', () => {
  it('uses standard skill frontmatter and current CLI guidance', () => {
    const skill = fs.readFileSync(skillPath, 'utf8');
    const frontmatter = skill.split('---', 3)[1];

    expect(frontmatter).toContain('name: create-zephyr-apps');
    expect(frontmatter).toContain('description:');
    expect(frontmatter).not.toMatch(/^version:/mu);
    expect(skill).toContain('create-zephyr-apps@latest');
    expect(skill).not.toContain('@<exact-version>');
    expect(skill).toContain('For web projects, pass `--template <id>`');
    expect(skill).toContain(
      'For React Native projects, pass `--project-type react-native`'
    );
    expect(skill).not.toContain('--template-revision');
  });
});
