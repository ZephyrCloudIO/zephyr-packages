import { findWorkspacePackagesNoCheck } from '@pnpm/workspace.find-packages';
import * as fs from 'node:fs';
import path from 'node:path';

export async function generatePnpmWorkspaceConfig(rootPath: string): Promise<string | null> {
  try {
    // Use @pnpm/workspace.find-packages to detect packages
    const packages = await findWorkspacePackagesNoCheck(rootPath);
    
    // If only one package found (likely the root), no workspace needed
    if (packages.length <= 1) {
      return null;
    }

    // Group packages by their parent directory structure
    const workspacePaths = new Set<string>();
    const commonDirs = ['apps', 'packages', 'libs', 'examples', 'tools'];
    
    for (const pkg of packages) {
      const relativePath = path.relative(rootPath, pkg.rootDir);
      
      // Skip root package
      if (!relativePath || relativePath === '.') {
        continue;
      }
      
      const pathParts = relativePath.split(path.sep);
      const topLevelDir = pathParts[0];
      
      // Check if it's a common workspace directory pattern
      if (commonDirs.includes(topLevelDir)) {
        workspacePaths.add(`"${topLevelDir}/*"`);
      } else {
        // Individual package directory
        workspacePaths.add(`"${relativePath}"`);
      }
    }

    // Only create workspace config if we found multiple packages
    if (workspacePaths.size > 0) {
      const sortedPaths = Array.from(workspacePaths).sort();
      return `packages:
${sortedPaths.map(p => `  - ${p}`).join('\n')}
  - "!**/dist/**"
  - "!**/build/**"
  - "!**/node_modules/**"
`;
    }

    return null;
  } catch (error) {
    // Fallback to manual detection if @pnpm modules fail
    return generateFallbackWorkspaceConfig(rootPath);
  }
}

// Fallback function for when @pnpm modules are not available
function generateFallbackWorkspaceConfig(rootPath: string): string | null {
  const workspacePaths: string[] = [];
  const commonDirs = ['apps', 'packages', 'libs', 'examples', 'tools'];

  // Check for common workspace directory patterns
  for (const dir of commonDirs) {
    const dirPath = path.join(rootPath, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const subDirs = fs.readdirSync(dirPath);
      const hasPackageJson = subDirs.some((subDir: string) => {
        const subDirPath = path.join(dirPath, subDir);
        return (
          fs.statSync(subDirPath).isDirectory() &&
          fs.existsSync(path.join(subDirPath, 'package.json'))
        );
      });

      if (hasPackageJson) {
        workspacePaths.push(`"${dir}/*"`);
      }
    }
  }

  // Check for package.json files in root-level directories
  const rootItems = fs.readdirSync(rootPath);
  const rootPackageDirs = rootItems.filter((item: string) => {
    const itemPath = path.join(rootPath, item);
    return (
      fs.statSync(itemPath).isDirectory() &&
      fs.existsSync(path.join(itemPath, 'package.json')) &&
      !commonDirs.includes(item) &&
      !item.startsWith('.') &&
      item !== 'node_modules'
    );
  });

  // Add individual directories that contain package.json
  rootPackageDirs.forEach((dir: string) => {
    workspacePaths.push(`"${dir}"`);
  });

  // Only create workspace config if we found multiple packages
  if (workspacePaths.length > 1) {
    return `packages:
${workspacePaths.map((p) => `  - ${p}`).join('\n')}
  - "!**/dist/**"
  - "!**/build/**"
  - "!**/node_modules/**"
`;
  }

  return null;
}
