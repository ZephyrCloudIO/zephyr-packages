import { describe, expect, it } from '@rstest/core';
import * as fs from 'node:fs';
import {
  NON_INTERACTIVE_EXAMPLE,
  NON_INTERACTIVE_EXAMPLE_ARGS,
  parseCliArgs,
  resolveCliOptions,
} from './cli.js';
import {
  DEFAULT_WEB_TEMPLATE,
  getTemplate,
  TemplateRepositories,
  Templates,
} from './templates.js';

describe('create-zephyr-apps CLI', () => {
  it('supports positional and flag-based project directories', () => {
    expect(parseCliArgs(['./positional'])).toMatchObject({
      directory: './positional',
    });
    expect(parseCliArgs(['--directory', './flagged'])).toMatchObject({
      directory: './flagged',
    });
    expect(() => parseCliArgs(['./positional', '--directory', './flagged'])).toThrow(
      'either positionally or with --directory'
    );
  });

  it('parses the documented non-interactive example', () => {
    expect(parseCliArgs([...NON_INTERACTIVE_EXAMPLE_ARGS])).toMatchObject({
      directory: './apps/example',
      template: 'react-rsbuild',
      packageManager: 'pnpm',
      initializeGit: false,
      install: true,
      build: true,
      json: true,
    });
  });

  it('uses deterministic non-interactive defaults', async () => {
    const resolved = await resolveCliOptions(parseCliArgs(['./example']), {
      interactive: false,
    });

    expect(resolved).toMatchObject({
      directory: './example',
      projectType: 'web',
      template: DEFAULT_WEB_TEMPLATE,
      initializeGit: false,
      install: false,
      build: false,
      templateRevision: TemplateRepositories.web.revision,
    });
  });

  it('installs dependencies when --build is requested', async () => {
    const resolved = await resolveCliOptions(parseCliArgs(['./example', '--build']), {
      interactive: false,
    });

    expect(resolved).toMatchObject({ install: true, build: true });
  });

  it('requires a directory when prompting is unavailable', async () => {
    await expect(
      resolveCliOptions(parseCliArgs([]), {
        interactive: false,
      })
    ).rejects.toThrow('A project directory is required');
  });

  it('resolves missing values through interactive prompts', async () => {
    const resolved = await resolveCliOptions(parseCliArgs([]), {
      interactive: true,
      prompts: {
        async directory() {
          return './interactive';
        },
        async projectType() {
          return 'web';
        },
        async template() {
          return 'react-rsbuild';
        },
        async initializeGit() {
          return true;
        },
      },
    });

    expect(resolved).toMatchObject({
      directory: './interactive',
      projectType: 'web',
      template: 'react-rsbuild',
      initializeGit: true,
    });
  });

  it('validates templates, project types, revisions, and Git flags', () => {
    expect(() => parseCliArgs(['./app', '--template', 'missing'])).toThrow(
      'Unknown template "missing"'
    );
    expect(() => parseCliArgs(['./app', '--project-type', 'desktop'])).toThrow(
      'Unsupported project type "desktop"'
    );
    expect(() => parseCliArgs(['./app', '--template-revision', 'main'])).toThrow(
      'full 40-character commit SHA'
    );
    expect(() => parseCliArgs(['./app', '--git', '--no-git'])).toThrow(
      '--git and --no-git'
    );
  });

  it('keeps the default and IDs valid in the pinned catalog', () => {
    expect(getTemplate(DEFAULT_WEB_TEMPLATE)).toBeDefined();
    expect(new Set(Templates.map(({ name }) => name)).size).toBe(Templates.length);
    expect(TemplateRepositories.web.revision).toMatch(/^[a-f\d]{40}$/u);
    expect(TemplateRepositories['react-native'].revision).toMatch(/^[a-f\d]{40}$/u);
  });

  it('tests the README example against the real parser', async () => {
    const readme = await fs.promises.readFile(
      new URL('../README.md', import.meta.url),
      'utf8'
    );
    expect(readme).toContain(NON_INTERACTIVE_EXAMPLE);
    expect(() => parseCliArgs([...NON_INTERACTIVE_EXAMPLE_ARGS])).not.toThrow();
  });
});
