import { afterEach, describe, expect, it } from '@rstest/core';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseCliArgs, resolveCliOptions, type ResolvedCliOptions } from './cli.js';
import {
  defaultCommandRunner,
  detectPackageManager,
  normalizeReceiptPath,
  ScaffoldFailure,
  scaffoldProject,
  type CommandRunner,
} from './scaffold.js';

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))
  );
});

describe('scaffoldProject', () => {
  it('normalizes machine-readable receipt paths to portable separators', () => {
    expect(normalizeReceiptPath('src\\components\\Header.tsx')).toBe(
      'src/components/Header.tsx'
    );
    expect(normalizeReceiptPath('C:\\work\\app\\dist\\index.js')).toBe(
      'C:/work/app/dist/index.js'
    );
  });

  it('scaffolds the React/Rsbuild template from an exact revision without a TTY', async () => {
    const fixture = await createTemplateRepository();
    const output = path.join(fixture.root, 'output');

    const receipt = await scaffoldProject(defaultOptions(output, fixture.revision), {
      repositories: {
        web: {
          name: 'fixture',
          url: fixture.repository,
          revision: fixture.revision,
        },
      },
    });

    expect(receipt.success).toBe(true);
    expect(receipt.directory).toBe(normalizeReceiptPath(output));
    expect(receipt.templateRevision).toBe(fixture.revision);
    expect(receipt.createdFiles).toContain('package.json');
    expect(receipt.createdFiles).toContain('src/index.ts');
    expect(receipt.commands.every(({ cwd }) => !cwd.includes('\\'))).toBe(true);
    expect(await fs.promises.readFile(path.join(output, 'src/index.ts'), 'utf8')).toBe(
      'export const fixture = true;\n'
    );
  });

  it('uses interactive answers with the same React/Rsbuild scaffolder', async () => {
    const fixture = await createTemplateRepository();
    const output = path.join(fixture.root, 'interactive-output');
    const options = await resolveCliOptions(parseCliArgs([]), {
      interactive: true,
      prompts: {
        async directory() {
          return output;
        },
        async projectType() {
          return 'web';
        },
        async template() {
          return 'react-rsbuild';
        },
        async initializeGit() {
          return false;
        },
      },
    });

    const receipt = await scaffoldProject(
      {
        ...options,
        templateRevision: fixture.revision,
      },
      {
        repositories: {
          web: {
            name: 'fixture',
            url: fixture.repository,
            revision: fixture.revision,
          },
        },
      }
    );

    expect(receipt.success).toBe(true);
    expect(receipt.template).toBe('react-rsbuild');
    expect(receipt.createdFiles).toContain('src/index.ts');
  });

  it('fails safely before fetching when the output directory is non-empty', async () => {
    const root = await makeTemporaryDirectory();
    const output = path.join(root, 'output');
    await fs.promises.mkdir(output);
    await fs.promises.writeFile(path.join(output, 'keep.txt'), 'keep');
    let commandCount = 0;

    await expect(
      scaffoldProject(defaultOptions(output, 'a'.repeat(40)), {
        runCommand: async () => {
          commandCount += 1;
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      })
    ).rejects.toMatchObject({
      exitCode: 1,
      receipt: {
        failures: [
          {
            stage: 'prepare',
          },
        ],
      },
    });

    expect(commandCount).toBe(0);
    expect(await fs.promises.readFile(path.join(output, 'keep.txt'), 'utf8')).toBe(
      'keep'
    );
  });

  it('propagates the package-manager install exit code and records the failure', async () => {
    const fixture = await createTemplateRepository();
    const output = path.join(fixture.root, 'output');
    const runner = packageManagerRunner({
      install: { exitCode: 23, stdout: '', stderr: 'install failed' },
    });

    let failure: ScaffoldFailure | undefined;
    try {
      await scaffoldProject(
        {
          ...defaultOptions(output, fixture.revision),
          install: true,
        },
        {
          runCommand: runner,
          repositories: {
            web: {
              name: 'fixture',
              url: fixture.repository,
              revision: fixture.revision,
            },
          },
        }
      );
    } catch (error) {
      failure = error as ScaffoldFailure;
    }

    expect(failure).toBeInstanceOf(ScaffoldFailure);
    expect(failure?.exitCode).toBe(23);
    expect(failure?.receipt.failures).toEqual([
      expect.objectContaining({
        stage: 'install',
        exitCode: 23,
        stderr: 'install failed',
      }),
    ]);
  });

  it('propagates the package-manager build exit code', async () => {
    const fixture = await createTemplateRepository();
    const output = path.join(fixture.root, 'output');
    const runner = packageManagerRunner({
      build: { exitCode: 31, stdout: '', stderr: 'build failed' },
    });

    await expect(
      scaffoldProject(
        {
          ...defaultOptions(output, fixture.revision),
          install: true,
          build: true,
        },
        {
          runCommand: runner,
          repositories: {
            web: {
              name: 'fixture',
              url: fixture.repository,
              revision: fixture.revision,
            },
          },
        }
      )
    ).rejects.toMatchObject({
      exitCode: 31,
      receipt: {
        failures: [
          expect.objectContaining({
            stage: 'build',
            exitCode: 31,
            stderr: 'build failed',
          }),
        ],
      },
    });
  });

  it('initializes and commits Git only when requested', async () => {
    const fixture = await createTemplateRepository();
    const output = path.join(fixture.root, 'output');

    await scaffoldProject(
      {
        ...defaultOptions(output, fixture.revision),
        initializeGit: true,
      },
      {
        repositories: {
          web: {
            name: 'fixture',
            url: fixture.repository,
            revision: fixture.revision,
          },
        },
      }
    );

    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%s'], {
      cwd: output,
    });
    expect(stdout.trim()).toBe('Initial commit from Zephyr');
  });

  it('records build artifacts and resolved workspace versions', async () => {
    const fixture = await createTemplateRepository();
    const output = path.join(fixture.root, 'output');
    const runner = packageManagerRunner({
      build: async () => {
        await fs.promises.mkdir(path.join(output, 'dist'));
        await fs.promises.writeFile(path.join(output, 'dist/index.js'), 'built');
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    const receipt = await scaffoldProject(
      {
        ...defaultOptions(output, fixture.revision),
        install: true,
        build: true,
      },
      {
        runCommand: runner,
        repositories: {
          web: {
            name: 'fixture',
            url: fixture.repository,
            revision: fixture.revision,
          },
        },
      }
    );

    expect(receipt.artifacts).toEqual(['dist/index.js']);
    expect(receipt.packageManager).toEqual({ name: 'pnpm', version: '11.17.0' });
    expect(receipt.resolvedPackageVersions).toContainEqual({
      name: 'fixture-template',
      version: '1.0.0',
      source: 'workspace',
    });
  });
});

describe('detectPackageManager', () => {
  it('prefers the template packageManager field, then the invocation user agent', async () => {
    const root = await makeTemporaryDirectory();
    const output = path.join(root, 'output');
    await fs.promises.mkdir(output);
    await fs.promises.writeFile(
      path.join(output, 'package.json'),
      JSON.stringify({ packageManager: 'yarn@4.0.0' })
    );

    await expect(
      detectPackageManager(output, root, {
        npm_config_user_agent: 'npm@11.0.0 node@24.0.0',
      })
    ).resolves.toBe('yarn');

    await fs.promises.rm(path.join(output, 'package.json'));
    await expect(
      detectPackageManager(output, root, {
        npm_config_user_agent: 'npm@11.0.0 node@24.0.0',
      })
    ).resolves.toBe('npm');
  });
});

function defaultOptions(directory: string, templateRevision: string): ResolvedCliOptions {
  return {
    directory,
    template: 'react-rsbuild',
    projectType: 'web',
    packageManager: 'pnpm',
    initializeGit: false,
    install: false,
    build: false,
    json: true,
    templateRevision,
  };
}

async function createTemplateRepository(): Promise<{
  root: string;
  repository: string;
  revision: string;
}> {
  const root = await makeTemporaryDirectory();
  const repository = path.join(root, 'repository');
  const template = path.join(repository, 'module-federation', 'react-rsbuild');
  await fs.promises.mkdir(path.join(template, 'src'), { recursive: true });
  await fs.promises.writeFile(
    path.join(repository, '.gitattributes'),
    '*.ts text eol=lf\n'
  );
  await fs.promises.writeFile(
    path.join(template, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture-template',
        version: '1.0.0',
        packageManager: 'pnpm@11.17.0',
        scripts: { build: 'node build.mjs' },
      },
      null,
      2
    )
  );
  await fs.promises.writeFile(
    path.join(template, 'src/index.ts'),
    'export const fixture = true;\n'
  );
  await execFileAsync('git', ['init', '--quiet'], { cwd: repository });
  await execFileAsync('git', ['add', '.'], { cwd: repository });
  await execFileAsync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    ],
    { cwd: repository }
  );
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: repository,
  });
  return { root, repository, revision: stdout.trim() };
}

function packageManagerRunner(
  overrides: {
    install?: Awaited<ReturnType<CommandRunner>> | (() => ReturnType<CommandRunner>);
    build?: Awaited<ReturnType<CommandRunner>> | (() => ReturnType<CommandRunner>);
  } = {}
): CommandRunner {
  return async (command, args, options) => {
    if (command !== 'pnpm') {
      return defaultCommandRunner(command, args, options);
    }
    if (args[0] === '--version') {
      return { exitCode: 0, stdout: '11.17.0\n', stderr: '' };
    }
    const override = args[0] === 'install' ? overrides.install : overrides.build;
    if (typeof override === 'function') return override();
    return override ?? { exitCode: 0, stdout: '', stderr: '' };
  };
}

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await fs.promises.mkdtemp(
    path.join(tmpdir(), 'create-zephyr-apps-test-')
  );
  temporaryDirectories.push(directory);
  return directory;
}
