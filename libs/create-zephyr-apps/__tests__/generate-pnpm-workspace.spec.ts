import type {
  Project,
  ProjectManifest,
  ProjectRootDir,
  ProjectRootDirRealPath,
} from '@pnpm/types';
import { findWorkspacePackagesNoCheck } from '@pnpm/workspace.find-packages';
import path from 'node:path';
import { generatePnpmWorkspaceConfig } from '../src/generate-pnpm-workspace';

// Mock the external dependency
jest.mock('@pnpm/workspace.find-packages', () => ({
  findWorkspacePackagesNoCheck: jest.fn(),
}));
const mockFindWorkspacePackagesNoCheck =
  findWorkspacePackagesNoCheck as jest.MockedFunction<
    typeof findWorkspacePackagesNoCheck
  >;

// Helper function to create a test Project object
const createMockProject = (
  rootDir: string,
  manifest: ProjectManifest = {} as ProjectManifest
): Project => ({
  rootDir: rootDir as ProjectRootDir,
  rootDirRealPath: rootDir as ProjectRootDirRealPath,
  manifest,
  writeProjectManifest: jest.fn(),
});

describe('generatePnpmWorkspaceConfig', () => {
  const mockRootPath = '/test/root';

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env['DEBUG'];
  });

  it('should return null when only one package is found', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([createMockProject('/test/root')]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toBeNull();
  });

  it('should return null when no packages are found', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toBeNull();
  });

  it('should generate workspace config for common directory patterns', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([
      createMockProject('/test/root'),
      createMockProject('/test/root/apps/app1'),
      createMockProject('/test/root/apps/app2'),
      createMockProject('/test/root/libs/lib1'),
      createMockProject('/test/root/packages/pkg1'),
    ]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toEqual({
      packages: ['apps/*', 'libs/*', 'packages/*'],
    });
  });

  it('should handle individual package directories not in common patterns', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([
      createMockProject('/test/root'),
      createMockProject('/test/root/custom-pkg'),
      createMockProject('/test/root/another-pkg'),
    ]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toEqual({
      packages: ['another-pkg', 'custom-pkg'],
    });
  });

  it('should mix common patterns with individual packages', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([
      createMockProject('/test/root'),
      createMockProject('/test/root/apps/app1'),
      createMockProject('/test/root/custom-pkg'),
      createMockProject('/test/root/libs/lib1'),
    ]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toEqual({
      packages: ['apps/*', 'custom-pkg', 'libs/*'],
    });
  });

  it('should handle nested packages in common directories', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([
      createMockProject('/test/root'),
      createMockProject('/test/root/apps/frontend/web'),
      createMockProject('/test/root/apps/backend/api'),
    ]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toEqual({
      packages: ['apps/*'],
    });
  });

  it('should skip root package when it has empty relative path', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([
      createMockProject(mockRootPath),
      createMockProject(path.join(mockRootPath, 'apps', 'app1')),
    ]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toEqual({
      packages: ['apps/*'],
    });
  });

  it('should handle all common directory patterns', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([
      createMockProject('/test/root'),
      createMockProject('/test/root/apps/app1'),
      createMockProject('/test/root/packages/pkg1'),
      createMockProject('/test/root/libs/lib1'),
      createMockProject('/test/root/examples/example1'),
      createMockProject('/test/root/tools/tool1'),
    ]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toEqual({
      packages: ['apps/*', 'examples/*', 'libs/*', 'packages/*', 'tools/*'],
    });
  });
});
