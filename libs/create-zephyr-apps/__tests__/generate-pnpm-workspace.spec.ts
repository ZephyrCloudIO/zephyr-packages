import { generatePnpmWorkspaceConfig } from '../src/generate-pnpm-workspace';
import { findWorkspacePackagesNoCheck } from '@pnpm/workspace.find-packages';
import type {
  ProjectManifest,
  ProjectRootDir,
  ProjectRootDirRealPath,
  Project,
} from '@pnpm/types';
import path from 'node:path';

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

    expect(result).toBe(`packages:
  - "apps/*"
  - "libs/*"
  - "packages/*"
  - "!**/dist/**"
  - "!**/build/**"
  - "!**/node_modules/**"
`);
  });

  it('should handle individual package directories not in common patterns', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([
      createMockProject('/test/root'),
      createMockProject('/test/root/custom-pkg'),
      createMockProject('/test/root/another-pkg'),
    ]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toBe(`packages:
  - "another-pkg"
  - "custom-pkg"
  - "!**/dist/**"
  - "!**/build/**"
  - "!**/node_modules/**"
`);
  });

  it('should mix common patterns with individual packages', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([
      createMockProject('/test/root'),
      createMockProject('/test/root/apps/app1'),
      createMockProject('/test/root/custom-pkg'),
      createMockProject('/test/root/libs/lib1'),
    ]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toBe(`packages:
  - "apps/*"
  - "custom-pkg"
  - "libs/*"
  - "!**/dist/**"
  - "!**/build/**"
  - "!**/node_modules/**"
`);
  });

  it('should handle nested packages in common directories', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([
      createMockProject('/test/root'),
      createMockProject('/test/root/apps/frontend/web'),
      createMockProject('/test/root/apps/backend/api'),
    ]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toBe(`packages:
  - "apps/*"
  - "!**/dist/**"
  - "!**/build/**"
  - "!**/node_modules/**"
`);
  });

  it('should skip root package when it has empty relative path', async () => {
    mockFindWorkspacePackagesNoCheck.mockResolvedValue([
      createMockProject(mockRootPath),
      createMockProject(path.join(mockRootPath, 'apps', 'app1')),
    ]);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toBe(`packages:
  - "apps/*"
  - "!**/dist/**"
  - "!**/build/**"
  - "!**/node_modules/**"
`);
  });

  it('should return null and log error in debug mode when findWorkspacePackagesNoCheck throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    process.env['DEBUG'] = 'true';

    const error = new Error('Test error');
    mockFindWorkspacePackagesNoCheck.mockRejectedValue(error);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error generating pnpm workspace config:',
      error
    );

    consoleErrorSpy.mockRestore();
  });

  it('should return null and log warning for ENOENT errors even without debug mode', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const error = new Error('ENOENT: no such file or directory');
    mockFindWorkspacePackagesNoCheck.mockRejectedValue(error);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Warning: Could not find package.json files for workspace detection'
    );

    consoleWarnSpy.mockRestore();
  });

  it('should return null silently for non-ENOENT errors without debug mode', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const error = new Error('Some other error');
    mockFindWorkspacePackagesNoCheck.mockRejectedValue(error);

    const result = await generatePnpmWorkspaceConfig(mockRootPath);

    expect(result).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
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

    expect(result).toBe(`packages:
  - "apps/*"
  - "examples/*"
  - "libs/*"
  - "packages/*"
  - "tools/*"
  - "!**/dist/**"
  - "!**/build/**"
  - "!**/node_modules/**"
`);
  });
});
