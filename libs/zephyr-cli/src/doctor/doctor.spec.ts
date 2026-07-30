import { afterEach, describe, expect, it } from '@rstest/core';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { analyzeProject } from './analyze';
import { formatDoctorReport } from './format';
import { DOCTOR_SCHEMA_VERSION, DoctorExitCode, DoctorFindingCode } from './schema';

const fixtureRoot = path.join(import.meta.dirname, '__fixtures__');
const temporaryDirectories: string[] = [];
const installedVersions = {
  '@module-federation/rsbuild-plugin': '2.8.0',
  '@rsbuild/core': '2.1.5',
  typescript: '5.9.3',
  'zephyr-rsbuild-plugin': '1.2.0',
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))
  );
});

describe('Zephyr Doctor Rsbuild fixtures', () => {
  it('returns a stable healthy report for a configured host/remote workspace', async () => {
    const project = await copyFixture('healthy-rsbuild');
    await writeInstalledPackages(project, installedVersions);

    const report = await analyzeProject(project);

    expect(report).toMatchObject({
      schemaVersion: DOCTOR_SCHEMA_VERSION,
      command: 'doctor',
      status: 'healthy',
      exitCode: DoctorExitCode.Healthy,
      packageManager: 'pnpm',
      lockfile: 'pnpm-lock.yaml',
      summary: { errors: 0, warnings: 0, info: 0 },
      watch: {
        mode: 'web',
        recommendedCommand: 'rsbuild build --watch',
      },
    });
    expect(report.findings).toEqual([]);
    expect(report.bundlers).toContainEqual({
      name: 'rsbuild',
      configFiles: ['apps/host/rsbuild.config.ts', 'apps/remote/rsbuild.config.ts'],
    });
    expect(report.configs).toContainEqual(
      expect.objectContaining({
        path: 'apps/host/rsbuild.config.ts',
        assetPrefix: 'auto',
        sourceEntry: true,
        remotes: ['remote'],
      })
    );
    expect(report.packages).toContainEqual(
      expect.objectContaining({
        name: '@rsbuild/core',
        locked: ['2.1.5'],
        installed: [
          {
            path: 'node_modules/@rsbuild/core/package.json',
            version: '2.1.5',
          },
        ],
      })
    );
    expect(report.dts.diagnosticCommands).toEqual([
      'FEDERATION_DEBUG=true pnpm run build',
      'pnpm exec rsbuild inspect',
    ]);
  });

  it('reports broken config, package state, watch mode, and DTS by stable code', async () => {
    const project = await copyFixture('broken-rsbuild');
    await writeInstalledPackages(project, {
      ...installedVersions,
      '@rsbuild/core': '2.0.0',
    });
    await fs.promises.mkdir(path.join(project, 'apps/remote/.mf'), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.join(project, 'apps/remote/.mf/typesGenerate.log'),
      'TYPE-001 failed while checking TS6059\n'
    );
    await fs.promises.mkdir(path.join(project, 'apps/remote/node_modules/.federation'), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.join(project, 'apps/remote/node_modules/.federation/tsconfig.generated.json'),
      '{}'
    );
    await fs.promises.writeFile(
      path.join(project, '.env'),
      'ZEPHYR_TOKEN=SECRET_VALUE\n'
    );
    const rootPackagePath = path.join(project, 'package.json');
    const rootPackage = JSON.parse(
      await fs.promises.readFile(rootPackagePath, 'utf8')
    ) as { devDependencies: Record<string, string> };
    rootPackage.devDependencies['@zephyr-cloud/private'] =
      'https://user:SECRET_VALUE@example.com/private.tgz';
    await fs.promises.writeFile(rootPackagePath, JSON.stringify(rootPackage, null, 2));
    const before = await captureTree(project);

    const report = await analyzeProject(project);
    const json = formatDoctorReport(report, 'json');
    const codes = new Set(report.findings.map(({ code }) => code));

    expect(report.status).toBe('findings');
    expect(report.exitCode).toBe(DoctorExitCode.Findings);
    for (const finding of report.findings) {
      expect(finding.code).toMatch(/^ZD\d{4}$/u);
      expect(['info', 'warning', 'error']).toContain(finding.severity);
      expect(finding.message.length).toBeGreaterThan(0);
      expect(finding.evidence.length).toBeGreaterThan(0);
      expect(finding.remediation.length).toBeGreaterThan(0);
    }
    expect([...codes]).toEqual(
      expect.arrayContaining([
        DoctorFindingCode.ZephyrPluginOrder,
        DoctorFindingCode.PackageVersionMismatch,
        DoctorFindingCode.AssetPrefixInvalid,
        DoctorFindingCode.AssetPrefixMissing,
        DoctorFindingCode.SourceEntryMissing,
        DoctorFindingCode.ExposeKeyInvalid,
        DoctorFindingCode.RemotesMustBeObject,
        DoctorFindingCode.RemoteDependencyAliasMismatch,
        DoctorFindingCode.WebWatchUsesTapCommand,
        DoctorFindingCode.DtsDiagnosticFailure,
      ])
    );
    expect(report.dts).toMatchObject({
      logs: ['apps/remote/.mf/typesGenerate.log'],
      temporaryArtifacts: [
        'apps/remote/node_modules/.federation/tsconfig.generated.json',
      ],
    });
    expect(JSON.parse(json)).toMatchObject({
      schemaVersion: DOCTOR_SCHEMA_VERSION,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: DoctorFindingCode.DtsDiagnosticFailure,
          severity: 'error',
          evidence: expect.any(Array),
          remediation: expect.any(String),
        }),
      ]),
    });
    expect(json).not.toContain('SECRET_VALUE');
    expect(await captureTree(project)).toEqual(before);
  });

  it('renders stable codes and remediation in text output', async () => {
    const project = await copyFixture('broken-rsbuild');
    await writeInstalledPackages(project, installedVersions);
    const report = await analyzeProject(project);
    const text = formatDoctorReport(report, 'text');

    expect(text).toContain(`Zephyr Doctor (schema ${DOCTOR_SCHEMA_VERSION})`);
    expect(text).toContain(DoctorFindingCode.AssetPrefixInvalid);
    expect(text).toContain('Remediation:');
  });
});

describe('Zephyr Doctor review regressions', () => {
  it('compares federation remotes when zephyr dependencies are absent', async () => {
    const project = await makeTemporaryDirectory();
    await writeJson(path.join(project, 'package.json'), {
      name: 'host',
      devDependencies: {
        '@module-federation/rsbuild-plugin': '2.8.0',
        '@rsbuild/core': '2.1.5',
        'zephyr-rsbuild-plugin': '1.2.0',
      },
    });
    await fs.promises.writeFile(
      path.join(project, 'rsbuild.config.ts'),
      `
        export default {
          plugins: [
            pluginModuleFederation({ remotes: { remote: 'remote@https://example.test/mf.js' } }),
            withZephyr(),
          ],
          output: { assetPrefix: 'auto' },
          source: { entry: { index: './src.ts' } },
        };
      `
    );

    const report = await analyzeProject(project);

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: DoctorFindingCode.RemoteDependencyAliasMismatch,
      })
    );
  });

  it('ignores pnpm workspace links when comparing package versions', async () => {
    const project = await makeTemporaryDirectory();
    await writeJson(path.join(project, 'package.json'), {
      name: 'workspace-link-consumer',
      packageManager: 'pnpm@11.17.0',
      dependencies: {
        '@zephyr-cloud/workspace-package': 'workspace:*',
      },
    });
    await fs.promises.writeFile(
      path.join(project, 'pnpm-lock.yaml'),
      `
        lockfileVersion: '9.0'
        importers:
          .:
            dependencies:
              '@zephyr-cloud/workspace-package':
                specifier: workspace:*
                version: link:../workspace-package
      `
    );
    await writeInstalledPackages(project, {
      '@zephyr-cloud/workspace-package': '1.2.0',
    });

    const report = await analyzeProject(project);
    const packageState = report.packages.find(
      ({ name }) => name === '@zephyr-cloud/workspace-package'
    );

    expect(packageState?.locked).toEqual([]);
    expect(report.findings.map(({ code }) => code)).not.toContain(
      DoctorFindingCode.PackageVersionMismatch
    );
  });

  it('parses Yarn Berry version fields for mismatch detection', async () => {
    const project = await makeTemporaryDirectory();
    await writeJson(path.join(project, 'package.json'), {
      name: 'yarn-project',
      packageManager: 'yarn@4.9.2',
      devDependencies: {
        typescript: '^5.0.0',
      },
    });
    await fs.promises.writeFile(
      path.join(project, 'yarn.lock'),
      [
        '__metadata:',
        '  version: 8',
        '',
        '"typescript@npm:^5.0.0":',
        '  version: 5.9.3',
        '  resolution: "typescript@npm:5.9.3"',
        '',
      ].join('\n')
    );
    await writeInstalledPackages(project, { typescript: '5.9.2' });

    const report = await analyzeProject(project);

    expect(report.packages.find(({ name }) => name === 'typescript')?.locked).toEqual([
      '5.9.3',
    ]);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: DoctorFindingCode.PackageVersionMismatch,
      })
    );
  });

  it('uses a lockfile-specific size bound above two MiB', async () => {
    const project = await makeTemporaryDirectory();
    await writeJson(path.join(project, 'package.json'), {
      name: 'large-lockfile-project',
      packageManager: 'pnpm@11.17.0',
      devDependencies: {
        typescript: '5.9.3',
      },
    });
    const lockfile = `
      lockfileVersion: '9.0'
      importers:
        .:
          devDependencies:
            typescript:
              specifier: 5.9.3
              version: 5.9.3
    `;
    await fs.promises.writeFile(
      path.join(project, 'pnpm-lock.yaml'),
      `${lockfile}\n#${'padding'.repeat(350_000)}\n`
    );
    await writeInstalledPackages(project, { typescript: '5.9.3' });

    const report = await analyzeProject(project);

    expect(report.status).not.toBe('tool_failure');
    expect(report.packages.find(({ name }) => name === 'typescript')?.locked).toEqual([
      '5.9.3',
    ]);
  });

  it('ignores commented-out configuration examples', async () => {
    const project = await makeTemporaryDirectory();
    await writeJson(path.join(project, 'package.json'), {
      name: 'commented-config',
      devDependencies: {
        '@module-federation/rsbuild-plugin': '2.8.0',
        '@rsbuild/core': '2.1.5',
        'zephyr-rsbuild-plugin': '1.2.0',
      },
    });
    await fs.promises.writeFile(
      path.join(project, 'rsbuild.config.ts'),
      `
        export default {
          // plugins: [pluginModuleFederation({}), withZephyr()],
          // output: { assetPrefix: 'auto' },
          /* source: { entry: { index: './src.ts' } } */
        };
      `
    );

    const report = await analyzeProject(project);
    const codes = report.findings.map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        DoctorFindingCode.ZephyrPluginConfigMissing,
        DoctorFindingCode.ModuleFederationPluginConfigMissing,
        DoctorFindingCode.AssetPrefixMissing,
        DoctorFindingCode.SourceEntryMissing,
      ])
    );
  });

  it('discovers only package manifests selected by workspace patterns', async () => {
    const project = await makeTemporaryDirectory();
    await writeJson(path.join(project, 'package.json'), {
      name: 'workspace-root',
      private: true,
      workspaces: ['packages/*'],
    });
    await fs.promises.mkdir(path.join(project, 'packages/member'), {
      recursive: true,
    });
    await writeJson(path.join(project, 'packages/member/package.json'), {
      name: 'member',
      devDependencies: { vite: '7.0.0' },
    });
    await fs.promises.mkdir(path.join(project, 'fixtures/ignored'), {
      recursive: true,
    });
    await writeJson(path.join(project, 'fixtures/ignored/package.json'), {
      name: 'ignored',
      devDependencies: { webpack: '5.0.0' },
    });

    const report = await analyzeProject(project);

    expect(report.bundlers.map(({ name }) => name)).toEqual(['vite']);
    expect(report.packages.map(({ name }) => name)).not.toContain('webpack');
  });

  it('derives Zephyr plugin order from plugins array entries', async () => {
    const project = await makeTemporaryDirectory();
    await writeJson(path.join(project, 'package.json'), {
      name: 'plugin-order',
      devDependencies: {
        '@module-federation/rsbuild-plugin': '2.8.0',
        '@rsbuild/core': '2.1.5',
        'zephyr-rsbuild-plugin': '1.2.0',
      },
    });
    const configPath = path.join(project, 'rsbuild.config.ts');
    await fs.promises.writeFile(
      configPath,
      `
        const zephyr = withZephyr();
        const federation = pluginModuleFederation({});
        export default {
          plugins: [federation, zephyr],
          output: { assetPrefix: 'auto' },
          source: { entry: { index: './src.ts' } },
        };
      `
    );

    const validReport = await analyzeProject(project);
    expect(validReport.findings.map(({ code }) => code)).not.toContain(
      DoctorFindingCode.ZephyrPluginOrder
    );

    await fs.promises.writeFile(
      configPath,
      `
        const federation = pluginModuleFederation({});
        const zephyr = withZephyr();
        export default {
          plugins: [zephyr, federation],
          output: { assetPrefix: 'auto' },
          source: { entry: { index: './src.ts' } },
        };
      `
    );
    const invalidReport = await analyzeProject(project);
    expect(invalidReport.findings).toContainEqual(
      expect.objectContaining({
        code: DoctorFindingCode.ZephyrPluginOrder,
      })
    );
  });

  it('rejects package manifests whose JSON root is not an object', async () => {
    const project = await makeTemporaryDirectory();
    for (const document of ['[]', 'true', '"package"']) {
      await fs.promises.writeFile(path.join(project, 'package.json'), document);

      const report = await analyzeProject(project);

      expect(report.status).toBe('invalid_project');
      expect(report.exitCode).toBe(DoctorExitCode.InvalidProject);
      expect(report.findings[0]?.code).toBe(DoctorFindingCode.PackageJsonInvalid);
    }
  });

  it('reports missing installations for each declaring workspace', async () => {
    const project = await makeTemporaryDirectory();
    await writeJson(path.join(project, 'package.json'), {
      name: 'workspace-root',
      private: true,
      workspaces: ['packages/*'],
    });
    for (const workspace of ['installed', 'missing']) {
      await fs.promises.mkdir(path.join(project, 'packages', workspace), {
        recursive: true,
      });
      await writeJson(path.join(project, 'packages', workspace, 'package.json'), {
        name: workspace,
        devDependencies: { typescript: '5.9.3' },
      });
    }
    await writeInstalledPackages(path.join(project, 'packages/installed'), {
      typescript: '5.9.3',
    });

    const report = await analyzeProject(project);
    const finding = report.findings.find(
      ({ code }) => code === DoctorFindingCode.PackageNotInstalled
    );

    expect(finding?.evidence).toEqual([
      expect.objectContaining({
        path: 'packages/missing/package.json',
      }),
    ]);
  });
});

describe('Zephyr Doctor exit classes', () => {
  it('distinguishes TAP watch requirements from web watch mode', async () => {
    const project = await makeTemporaryDirectory();
    await fs.promises.writeFile(
      path.join(project, 'package.json'),
      JSON.stringify({
        name: 'tap-package',
        private: true,
        scripts: {
          watch: 'ze-cli watch ./dist',
        },
        devDependencies: {
          'zephyr-tap-runtime': '1.2.0',
        },
      })
    );

    const report = await analyzeProject(project);
    const codes = report.findings.map(({ code }) => code);

    expect(report.watch.mode).toBe('tap-app');
    expect(report.watch.recommendedCommand).toContain('--target tap-app');
    expect(codes).toEqual(
      expect.arrayContaining([
        DoctorFindingCode.TapWatchTargetMissing,
        DoctorFindingCode.TapWatchMetadataMissing,
      ])
    );
    expect(codes).not.toContain(DoctorFindingCode.WebWatchUsesTapCommand);
  });

  it('distinguishes an invalid project from diagnostic findings', async () => {
    const project = await makeTemporaryDirectory();
    const report = await analyzeProject(project);

    expect(report.status).toBe('invalid_project');
    expect(report.exitCode).toBe(DoctorExitCode.InvalidProject);
    expect(report.findings[0]?.code).toBe(DoctorFindingCode.PackageJsonMissing);
  });

  it('flags a TAP project without a ze-cli watch command', async () => {
    const project = await makeTemporaryDirectory();
    await writeJson(path.join(project, 'package.json'), {
      name: 'tap-package',
      private: true,
      scripts: {
        watch: 'rsbuild build --watch',
      },
      devDependencies: {
        'zephyr-tap-runtime': '1.2.0',
      },
    });

    const report = await analyzeProject(project);

    expect(report.watch.mode).toBe('tap-app');
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: DoctorFindingCode.TapWatchTargetMissing,
      })
    );
  });

  it('returns a structured tool failure for an unreadable scan input', async () => {
    const project = await makeTemporaryDirectory();
    await fs.promises.writeFile(
      path.join(project, 'package.json'),
      Buffer.alloc(2 * 1024 * 1024 + 1)
    );

    const report = await analyzeProject(project);

    expect(report.status).toBe('tool_failure');
    expect(report.exitCode).toBe(DoctorExitCode.ToolFailure);
    expect(report.findings).toEqual([
      expect.objectContaining({
        code: DoctorFindingCode.ToolFailure,
        severity: 'error',
      }),
    ]);
  });
});

async function copyFixture(name: string): Promise<string> {
  const temporaryDirectory = await makeTemporaryDirectory();
  const project = path.join(temporaryDirectory, name);
  await fs.promises.cp(path.join(fixtureRoot, name), project, {
    recursive: true,
  });
  await materializePackageManifests(project);
  return project;
}

async function materializePackageManifests(directory: string): Promise<void> {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await materializePackageManifests(absolutePath);
    } else if (entry.name === 'package.fixture.json') {
      await fs.promises.rename(absolutePath, path.join(directory, 'package.json'));
    }
  }
}

async function writeInstalledPackages(
  project: string,
  versions: Record<string, string>
): Promise<void> {
  for (const [name, version] of Object.entries(versions)) {
    const packageDirectory = path.join(project, 'node_modules', name);
    await fs.promises.mkdir(packageDirectory, { recursive: true });
    await fs.promises.writeFile(
      path.join(packageDirectory, 'package.json'),
      JSON.stringify({ name, version })
    );
  }
}

async function writeJson(absolutePath: string, value: unknown): Promise<void> {
  await fs.promises.writeFile(absolutePath, JSON.stringify(value, null, 2));
}

async function captureTree(root: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  const visit = async (directory: string): Promise<void> => {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else {
        const content = await fs.promises.readFile(absolutePath);
        snapshot[path.relative(root, absolutePath)] = createHash('sha256')
          .update(content)
          .digest('hex');
      }
    }
  };
  await visit(root);
  return snapshot;
}

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await fs.promises.mkdtemp(path.join(tmpdir(), 'ze-cli-doctor-test-'));
  temporaryDirectories.push(directory);
  return directory;
}
