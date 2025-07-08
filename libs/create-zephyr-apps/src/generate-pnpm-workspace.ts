import { findWorkspacePackagesNoCheck } from '@pnpm/workspace.find-packages';
import path from 'node:path';

export interface WorkspaceConfig {
  packages: string[];
}

export async function generatePnpmWorkspaceConfig(
  rootPath: string
): Promise<WorkspaceConfig | null> {
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

      // Skip root package and validate path
      if (!relativePath || relativePath === '.' || relativePath.startsWith('..')) {
        continue;
      }
      const pathParts = relativePath.split(path.sep);
      const topLevelDir = pathParts[0];

      // Check if it's a common workspace directory pattern
      if (commonDirs.includes(topLevelDir)) {
        workspacePaths.add(`${topLevelDir}/*`);
      } else {
        // Individual package directory
        workspacePaths.add(relativePath);
      }
    }

    // Only create workspace config if we found multiple packages
    if (workspacePaths.size > 0) {
      const sortedPaths = Array.from(workspacePaths).sort();
      return {
        packages: [...sortedPaths],
      };
    }

    return null;
  } catch (error) {
    console.error(error);

    return null;
  }
}
