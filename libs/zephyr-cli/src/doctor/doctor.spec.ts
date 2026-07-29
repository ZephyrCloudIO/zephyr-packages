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
